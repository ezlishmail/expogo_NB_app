import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Prisma, Coupon } from "@prisma/client";
import prisma from "../db";
import { badRequest, conflict, isUniqueViolation, notFound } from "../lib/errors";
import { computeDiscount, computeTotals } from "../lib/money";
import { notifyUser } from "../lib/notify";

async function getTenant() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: process.env.TENANT_SLUG } });
  if (!tenant) throw badRequest("TENANT_NOT_FOUND", "Tenant not configured");
  return tenant;
}

// Find + fully validate a coupon against a subtotal and this user's history.
export async function validateCoupon(opts: {
  tenantId: string;
  code: string;
  userId: string;
  subtotalCents: number;
}): Promise<Coupon> {
  const coupon = await prisma.coupon.findUnique({
    where: { tenantId_code: { tenantId: opts.tenantId, code: opts.code.toUpperCase() } },
  });
  if (!coupon) throw badRequest("COUPON_INVALID", "Coupon code not recognized");

  const check = computeDiscount(coupon, opts.subtotalCents);
  if (!check.ok) {
    throw badRequest(check.reason ?? "COUPON_INVALID", "Coupon cannot be applied");
  }
  if (coupon.maxUses !== null) {
    const total = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    if (total >= coupon.maxUses) throw badRequest("COUPON_EXHAUSTED", "Coupon has no uses left");
  }
  if (coupon.maxPerUser > 0) {
    const mine = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: opts.userId },
    });
    if (mine >= coupon.maxPerUser) {
      throw badRequest("COUPON_PER_USER_LIMIT", "You have already used this coupon");
    }
  }
  return coupon;
}

export async function shopRoutes(app: FastifyInstance): Promise<void> {
  const authed = { preHandler: [app.authenticate] };

  app.post("/coupons/validate", authed, async (request) => {
      const input = z
        .object({ code: z.string().min(1).max(40), subtotalCents: z.number().int().min(0) })
        .parse(request.body);
      const tenant = await getTenant();
      const coupon = await validateCoupon({
        tenantId: tenant.id,
        code: input.code,
        userId: request.user.sub,
        subtotalCents: input.subtotalCents,
      });
      const check = computeDiscount(coupon, input.subtotalCents);
      return { valid: true, discountCents: check.discountCents };
    },
  );

  const checkoutSchema = z.object({
    items: z
      .array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
      .min(1)
      .max(50),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    addressId: z.string().uuid().optional(),
    address: z
      .object({
        line1: z.string().min(1).max(200),
        city: z.string().max(80).optional(),
        postalCode: z.string().max(16).optional(),
        notes: z.string().max(300).optional(),
      })
      .optional(),
    couponCode: z.string().max(40).optional(),
    paymentMethod: z.enum(["CASH"]).default("CASH"),
    notes: z.string().max(500).optional(),
  });

  // Checkout. Totals are computed here, never trusted from the client; stock
  // is decremented conditionally inside the transaction so overselling is
  // impossible even under concurrency.
  app.post("/orders", { ...authed, config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = checkoutSchema.parse(request.body);
    const tenant = await getTenant();
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;

    if (input.fulfillment === "DELIVERY") {
      const features = (tenant.features ?? {}) as Record<string, unknown>;
      if (features.delivery === false) throw badRequest("DELIVERY_DISABLED", "Delivery is currently unavailable");
      if (!input.address && !input.addressId) {
        throw badRequest("ADDRESS_REQUIRED", "A delivery address is required");
      }
    }
    if (input.fulfillment === "PICKUP" && settings.pickupEnabled === false) {
      throw badRequest("PICKUP_DISABLED", "Pickup is currently unavailable");
    }

    let savedAddress: { label: string | null; line1: string; city: string | null; postalCode: string | null; notes: string | null } | null = null;
    if (input.addressId) {
      const a = await prisma.address.findUnique({ where: { id: input.addressId } });
      if (!a || a.userId !== request.user.sub) throw notFound("Address not found");
      savedAddress = a;
    } else if (input.address) {
      savedAddress = await prisma.address.create({
        data: { ...input.address, userId: request.user.sub, label: null },
      });
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const ids = [...new Set(input.items.map((i) => i.productId))];
          const products = await tx.product.findMany({
            where: { id: { in: ids }, tenantId: tenant.id, active: true },
          });
          const byId = new Map(products.map((p) => [p.id, p]));

          let subtotalCents = 0;
          const lines = input.items.map((i) => {
            const p = byId.get(i.productId);
            if (!p) throw badRequest("PRODUCT_UNAVAILABLE", `Product ${i.productId} is unavailable`);
            if (p.trackStock && p.stock < i.qty) {
              throw conflict("INSUFFICIENT_STOCK", `${p.name} only has ${Math.max(p.stock, 0)} left`);
            }
            subtotalCents += p.priceCents * i.qty;
            return { product: p, qty: i.qty };
          });

          let discountCents = 0;
          let coupon: Coupon | null = null;
          if (input.couponCode) {
            coupon = await validateCoupon({
              tenantId: tenant.id,
              code: input.couponCode,
              userId: request.user.sub,
              subtotalCents,
            });
            discountCents = computeDiscount(coupon, subtotalCents).discountCents;
          }

          const { deliveryFeeCents, codChargeCents, totalCents } = computeTotals({
            subtotalCents,
            discountCents,
            fulfillment: input.fulfillment,
            settings: tenant.settings,
          });

          for (const line of lines) {
            if (!line.product.trackStock) continue;
            const res = await tx.product.updateMany({
              where: { id: line.product.id, stock: { gte: line.qty } },
              data: { stock: { decrement: line.qty } },
            });
            if (res.count !== 1) {
              throw conflict("INSUFFICIENT_STOCK", `${line.product.name} just sold out`);
            }
          }

          const order = await tx.order.create({
            data: {
              tenantId: tenant.id,
              customerId: request.user.sub,
              status: "PLACED",
              fulfillment: input.fulfillment,
              address:
                input.fulfillment === "DELIVERY" && savedAddress
                  ? ({
                      label: savedAddress.label,
                      line1: savedAddress.line1,
                      city: savedAddress.city,
                      postalCode: savedAddress.postalCode,
                      notes: savedAddress.notes,
                    } as Prisma.InputJsonValue)
                  : undefined,
              subtotalCents,
              discountCents,
              deliveryFeeCents,
              codChargeCents,
              totalCents,
              ...(coupon ? { couponId: coupon.id } : {}),
              notes: input.notes ?? null,
              items: {
                create: lines.map((l) => ({
                  productId: l.product.id,
                  name: l.product.name,
                  unitPriceCents: l.product.priceCents,
                  qty: l.qty,
                })),
              },
              payments: {
                create: { method: input.paymentMethod, status: "UNPAID", amountCents: totalCents },
              },
            },
            include: { items: true },
          });

          if (coupon) {
            await tx.couponRedemption.create({
              data: { couponId: coupon.id, userId: request.user.sub, orderId: order.id },
            });
          }

          return order;
        },
        // Neon cold starts can eat several seconds on the first queries.
        { timeout: 20_000, maxWait: 10_000 },
      );

      void notifyUser(request.user.sub, "ORDER_CONFIRMED", {
        title: "Order received",
        body: `Order #${result.id.slice(0, 8)} — we'll confirm it shortly`,
        deeplink: `/order/${result.id}`,
      });

      return reply.code(201).send({
        order: {
          id: result.id,
          status: result.status,
          fulfillment: result.fulfillment,
          subtotalCents: result.subtotalCents,
          discountCents: result.discountCents,
          deliveryFeeCents: result.deliveryFeeCents,
          codChargeCents: result.codChargeCents,
          totalCents: result.totalCents,
          items: result.items.map((i) => ({ name: i.name, qty: i.qty, unitPriceCents: i.unitPriceCents })),
          placedAt: result.placedAt.toISOString(),
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict("ORDER_DUPLICATE", "This order was already placed");
      }
      throw err;
    }
  });

  app.get("/orders", authed, async (request) => {
    const rows = await prisma.order.findMany({
      where: { customerId: request.user.sub },
      include: { items: true },
      orderBy: { placedAt: "desc" },
      take: 50,
    });
    return {
      orders: rows.map((o) => ({
        id: o.id,
        status: o.status,
        fulfillment: o.fulfillment,
        totalCents: o.totalCents,
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
        placedAt: o.placedAt.toISOString(),
      })),
    };
  });

  app.get("/orders/:id", authed, async (request) => {
    const { id } = request.params as { id: string };
    const o = await prisma.order.findFirst({
      where: { id, customerId: request.user.sub },
      include: { items: true, payments: true },
    });
    if (!o) throw notFound("Order not found");
    return {
      order: {
        id: o.id,
        status: o.status,
        fulfillment: o.fulfillment,
        address: o.address,
        subtotalCents: o.subtotalCents,
        discountCents: o.discountCents,
        deliveryFeeCents: o.deliveryFeeCents,
        codChargeCents: o.codChargeCents,
        totalCents: o.totalCents,
        notes: o.notes,
        placedAt: o.placedAt.toISOString(),
        items: o.items.map((i) => ({ name: i.name, qty: i.qty, unitPriceCents: i.unitPriceCents })),
        payment: o.payments[0]
          ? { method: o.payments[0].method, status: o.payments[0].status }
          : null,
      },
    };
  });
}
