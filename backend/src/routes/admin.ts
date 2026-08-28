import type { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../db";
import { badRequest, notFound } from "../lib/errors";
import { broadcast, notifyUser } from "../lib/notify";
import { parseTenantSettings } from "../lib/booking";
import { todayIn, startOfDayUtc } from "../lib/tz";

async function getTenant() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: process.env.TENANT_SLUG } });
  if (!tenant) throw badRequest("TENANT_NOT_FOUND", "Tenant not configured");
  return tenant;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const admin = {
    preHandler: [app.requireAdmin],
    config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
  };

  // ---------- dashboard ----------
  app.get("/admin/stats", admin, async () => {
    const tenant = await getTenant();
    const cfg = parseTenantSettings(tenant.settings);
    const dayStart = startOfDayUtc(todayIn(cfg.timezone), cfg.timezone);

    const [ordersToday, appointmentsToday, pendingOrders, lowStock, revenueAgg] =
      await Promise.all([
        prisma.order.count({ where: { tenantId: tenant.id, placedAt: { gte: dayStart } } }),
        prisma.appointment.count({
          where: { tenantId: tenant.id, startsAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400_000) } },
        }),
        prisma.order.count({
          where: { tenantId: tenant.id, status: { in: ["PLACED", "CONFIRMED"] } },
        }),
        prisma.product.count({
          where: { tenantId: tenant.id, trackStock: true, stock: { lte: 5 }, active: true },
        }),
        prisma.order.aggregate({
          where: {
            tenantId: tenant.id,
            placedAt: { gte: dayStart },
            status: { not: "CANCELLED" },
          },
          _sum: { totalCents: true },
        }),
      ]);

    return {
      ordersToday,
      appointmentsToday,
      pendingOrders,
      lowStockCount: lowStock,
      revenueTodayCents: revenueAgg._sum.totalCents ?? 0,
    };
  });

  // ---------- services ----------
  const serviceInput = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullable().optional(),
    durationMin: z.number().int().min(5).max(600),
    priceCents: z.number().int().min(0).max(10_000_00),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    category: z.string().max(80).nullable().optional(),
    forGender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  });

  app.get("/admin/services", admin, async () => {
    const tenant = await getTenant();
    const rows = await prisma.service.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return { services: rows };
  });

  app.post("/admin/services", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = serviceInput.parse(request.body);
    const service = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: input.name,
        description: input.description ?? null,
        durationMin: input.durationMin,
        priceCents: input.priceCents,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 0,
        category: input.category ?? null,
        forGender: input.forGender ?? null,
      },
    });
    return reply.code(201).send({ service });
  });

  app.patch("/admin/services/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.service.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Service not found");
    const input = serviceInput.partial().parse(request.body);
    const service = await prisma.service.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        durationMin: input.durationMin,
        priceCents: input.priceCents,
        active: input.active,
        sortOrder: input.sortOrder,
        category: input.category,
        forGender: input.forGender,
      },
    });
    return { service };
  });

  app.delete("/admin/services/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.service.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Service not found");
    await prisma.service.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });

  // ---------- staff ----------
  const staffInput = z.object({
    name: z.string().min(1).max(120),
    bio: z.string().max(1000).nullable().optional(),
    active: z.boolean().optional(),
    gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
    photoUrl: z.string().url().max(500).nullable().optional(),
    specialties: z.array(z.string().min(1).max(40)).max(30).optional(),
    serviceIds: z.array(z.string().uuid()).optional(),
    availability: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          startMin: z.number().int().min(0).max(1440),
          endMin: z.number().int().min(0).max(1440),
        }),
      )
      .optional(),
    timeOff: z
      .array(z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }))
      .optional(),
  });

  app.get("/admin/staff", admin, async () => {
    const tenant = await getTenant();
    const rows = await prisma.staff.findMany({
      where: { tenantId: tenant.id },
      include: {
        staffServices: { select: { serviceId: true } },
        availability: true,
      },
      orderBy: { name: "asc" },
    });
    return {
      staff: rows.map((s) => ({
        id: s.id,
        name: s.name,
        bio: s.bio,
        active: s.active,
        gender: s.gender,
        photoUrl: s.photoUrl,
        specialties: s.specialties,
        serviceIds: s.staffServices.map((x) => x.serviceId),
        availability: s.availability.map((a) => ({ weekday: a.weekday, startMin: a.startMin, endMin: a.endMin })),
      })),
    };
  });

  app.post("/admin/staff", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = staffInput.parse(request.body);
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: input.name,
        bio: input.bio ?? null,
        active: input.active ?? true,
        gender: input.gender ?? null,
        photoUrl: input.photoUrl ?? null,
        specialties: input.specialties ?? [],
        ...(input.serviceIds
          ? { staffServices: { create: input.serviceIds.map((serviceId) => ({ serviceId })) } }
          : {}),
        ...(input.availability
          ? { availability: { create: input.availability } }
          : {}),
      },
    });
    return reply.code(201).send({ staff });
  });

  app.patch("/admin/staff/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const input = staffInput.partial().parse(request.body);
    const existing = await prisma.staff.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Staff not found");

    await prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id },
        data: {
          name: input.name,
          bio: input.bio ?? undefined,
          active: input.active,
          gender: input.gender,
          photoUrl: input.photoUrl,
          specialties: input.specialties,
        },
      });
      if (input.serviceIds) {
        await tx.staffService.deleteMany({ where: { staffId: id } });
        if (input.serviceIds.length > 0) {
          await tx.staffService.createMany({
            data: input.serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
          });
        }
      }
      if (input.availability) {
        await tx.staffAvailability.deleteMany({ where: { staffId: id } });
        if (input.availability.length > 0) {
          await tx.staffAvailability.createMany({
            data: input.availability.map((a) => ({ ...a, staffId: id })),
          });
        }
      }
      if (input.timeOff) {
        await tx.timeOff.deleteMany({ where: { staffId: id } });
        if (input.timeOff.length > 0) {
          await tx.timeOff.createMany({
            data: input.timeOff.map((t) => ({
              staffId: id,
              startsAt: new Date(t.startsAt),
              endsAt: new Date(t.endsAt),
            })),
          });
        }
      }
    });
    return { ok: true };
  });

  app.delete("/admin/staff/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.staff.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Staff not found");
    await prisma.staff.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });

  // ---------- categories & products ----------
  const categoryInput = z.object({ name: z.string().min(1).max(80), sortOrder: z.number().int().optional() });

  app.get("/admin/categories", admin, async () => {
    const tenant = await getTenant();
    return {
      categories: await prisma.productCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: "asc" },
      }),
    };
  });

  app.post("/admin/categories", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = categoryInput.parse(request.body);
    const category = await prisma.productCategory.create({
      data: { tenantId: tenant.id, name: input.name, sortOrder: input.sortOrder ?? 0 },
    });
    return reply.code(201).send({ category });
  });

  app.delete("/admin/categories/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.productCategory.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Category not found");
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw badRequest("CATEGORY_NOT_EMPTY", "Move products out of this category first");
    await prisma.productCategory.delete({ where: { id } });
    return { ok: true };
  });

  const productInput = z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(5000).nullable().optional(),
    priceCents: z.number().int().min(0).max(10_000_00),
    categoryId: z.string().uuid().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    stock: z.number().int().min(0).optional(),
    trackStock: z.boolean().optional(),
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
  });

  app.get("/admin/products", admin, async () => {
    const tenant = await getTenant();
    return {
      products: await prisma.product.findMany({
        where: { tenantId: tenant.id },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    };
  });

  app.post("/admin/products", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = productInput.parse(request.body);
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        categoryId: input.categoryId ?? null,
        imageUrl: input.imageUrl ?? null,
        stock: input.stock ?? 0,
        trackStock: input.trackStock ?? true,
        active: input.active ?? true,
        featured: input.featured ?? false,
      },
    });
    return reply.code(201).send({ product });
  });

  app.patch("/admin/products/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.product.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Product not found");
    const input = productInput.partial().parse(request.body);
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        priceCents: input.priceCents,
        categoryId: input.categoryId === null ? null : input.categoryId,
        imageUrl: input.imageUrl,
        stock: input.stock,
        trackStock: input.trackStock,
        active: input.active,
        featured: input.featured,
      },
    });
    return { product };
  });

  app.delete("/admin/products/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.product.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Product not found");
    await prisma.product.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });

  // Manual stock change with a REQUIRED reason. Sales decrements happen inside
  // the order transaction; this endpoint is for restocks/damage/corrections and
  // writes an audit row (who + why) alongside updating the on-hand count.
  const stockAdjustInput = z.object({
    delta: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, { message: "delta must be non-zero" }),
    reason: z.string().min(1).max(200),
  });

  app.post("/admin/products/:id/stock", admin, async (request, reply) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const input = stockAdjustInput.parse(request.body);
    const product = await prisma.product.findFirst({ where: { id, tenantId: tenant.id } });
    if (!product) throw notFound("Product not found");

    const newStock = product.stock + input.delta;
    if (newStock < 0) {
      throw badRequest("STOCK_NEGATIVE", `Only ${product.stock} in stock — cannot remove ${Math.abs(input.delta)}`);
    }

    const [updated] = await prisma.$transaction([
      prisma.product.update({ where: { id }, data: { stock: newStock } }),
      prisma.stockAdjustment.create({
        data: {
          tenantId: tenant.id,
          productId: id,
          delta: input.delta,
          reason: input.reason,
          createdById: request.user.sub,
        },
      }),
    ]);
    return reply.code(201).send({ product: updated });
  });

  app.get("/admin/products/:id/stock", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const product = await prisma.product.findFirst({ where: { id, tenantId: tenant.id } });
    if (!product) throw notFound("Product not found");
    const adjustments = await prisma.stockAdjustment.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { adjustments };
  });

  // ---------- coupons ----------
  const couponInput = z.object({
    code: z.string().min(2).max(40).transform((v) => v.toUpperCase()),
    kind: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().min(1).max(10_000_00),
    minOrderCents: z.number().int().min(0).default(0),
    startsAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    maxPerUser: z.number().int().min(0).default(1),
    active: z.boolean().optional(),
  });

  app.get("/admin/coupons", admin, async () => {
    const tenant = await getTenant();
    return {
      coupons: await prisma.coupon.findMany({
        where: { tenantId: tenant.id },
        orderBy: { code: "asc" },
      }),
    };
  });

  app.post("/admin/coupons", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = couponInput.parse(request.body);
    try {
      const coupon = await prisma.coupon.create({
        data: {
          tenantId: tenant.id,
          code: input.code,
          kind: input.kind,
          value: input.value,
          minOrderCents: input.minOrderCents,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          maxUses: input.maxUses ?? null,
          maxPerUser: input.maxPerUser,
          active: input.active ?? true,
        },
      });
      return reply.code(201).send({ coupon });
    } catch {
      throw badRequest("COUPON_CODE_TAKEN", "That coupon code already exists");
    }
  });

  app.patch("/admin/coupons/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.coupon.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Coupon not found");
    const input = couponInput.partial().parse(request.body);
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: input.code,
        kind: input.kind,
        value: input.value,
        minOrderCents: input.minOrderCents,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
        maxUses: input.maxUses === undefined ? undefined : input.maxUses,
        maxPerUser: input.maxPerUser,
        active: input.active,
      },
    });
    return { coupon };
  });

  app.delete("/admin/coupons/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const existing = await prisma.coupon.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw notFound("Coupon not found");
    await prisma.coupon.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });

  // ---------- appointments management ----------
  app.get("/admin/appointments", admin, async (request) => {
    const tenant = await getTenant();
    const q = z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(request.query);

    let range: { startsAt: { gte: Date; lt: Date } } | {} = {};
    if (q.date) {
      const cfg = parseTenantSettings(tenant.settings);
      const start = startOfDayUtc(q.date, cfg.timezone);
      range = { startsAt: { gte: start, lt: new Date(start.getTime() + 86400_000) } };
    }

    const rows = await prisma.appointment.findMany({
      where: { tenantId: tenant.id, ...range },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        service: { select: { name: true, durationMin: true, priceCents: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
    });
    return { appointments: rows };
  });

  const apptUpdate = z.object({
    status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
    notes: z.string().max(1000).nullable().optional(),
  });

  app.patch("/admin/appointments/:id", admin, async (request) => {
    const { id } = request.params as { id: string };
    const tenant = await getTenant();
    const input = apptUpdate.parse(request.body);
    const appt = await prisma.appointment.findFirst({
      where: { id, tenantId: tenant.id },
      include: { service: { select: { name: true } } },
    });
    if (!appt) throw notFound("Appointment not found");

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: input.status, notes: input.notes },
    });

    if (input.status === "CANCELLED") {
      void notifyUser(appt.customerId, "APPOINTMENT_CANCELLED", {
        title: "Appointment cancelled",
        body: appt.service.name,
        deeplink: `/appointment/${updated.id}`,
      });
    }
    return { appointment: updated };
  });

  // ---------- orders management ----------
  app.get("/admin/orders", admin, async (request) => {
    const tenant = await getTenant();
    const q = z
      .object({ status: z.enum(["PLACED", "CONFIRMED", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED"]).optional() })
      .parse(request.query);
    return {
      orders: await prisma.order.findMany({
        where: { tenantId: tenant.id, ...(q.status ? { status: q.status } : {}) },
        include: {
          customer: { select: { name: true, email: true } },
          items: true,
          payments: true,
        },
        orderBy: { placedAt: "desc" },
        take: 200,
      }),
    };
  });

  const orderUpdate = z.object({
    status: z.enum(["PLACED", "CONFIRMED", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED"]).optional(),
    paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED", "FAILED"]).optional(),
  });

  app.patch("/admin/orders/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const input = orderUpdate.parse(request.body);
    const order = await prisma.order.findFirst({
      where: { id, tenantId: tenant.id },
      include: { items: true },
    });
    if (!order) throw notFound("Order not found");

    const updated = await prisma.order.update({
      where: { id },
      data: { status: input.status },
    });
    if (input.paymentStatus) {
      await prisma.payment.updateMany(
        { where: { orderId: id }, data: { status: input.paymentStatus } },
      );
    }

    if (input.status && input.status !== order.status) {
      void notifyUser(order.customerId, "ORDER_STATUS", {
        title: `Order #${order.id.slice(0, 8)} ${input.status.toLowerCase().replace(/_/g, " ")}`,
        body: order.items.length > 0 ? `${order.items.reduce((n, i) => n + i.qty, 0)} item(s)` : null,
        deeplink: `/order/${order.id}`,
      });
    }
    return { order: updated };
  });

  // ---------- customers (user management) ----------
  app.get("/admin/customers", admin, async (request) => {
    const tenant = await getTenant();
    const q = z
      .object({ search: z.string().max(80).optional() })
      .parse(request.query ?? {});
    const customers = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: "CUSTOMER",
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { email: { contains: q.search, mode: "insensitive" } },
                { phone: { contains: q.search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        marketingOptIn: true,
        createdAt: true,
        _count: { select: { orders: true, appointments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { customers };
  });

  const customerUpdate = z.object({
    name: z.string().min(1).max(80).optional(),
    phone: z.string().min(7).max(24).nullable().optional(),
    marketingOptIn: z.boolean().optional(),
  });

  app.patch("/admin/users/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const input = customerUpdate.parse(request.body);
    const user = await prisma.user.findFirst({ where: { id, tenantId: tenant.id } });
    if (!user) throw notFound("User not found");
    if (user.role !== "CUSTOMER") {
      throw badRequest("NOT_A_CUSTOMER", "Staff/owner accounts are managed in NYX SYS");
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { name: input.name, phone: input.phone, marketingOptIn: input.marketingOptIn },
    });
    return { user: { id: updated.id, name: updated.name, phone: updated.phone, marketingOptIn: updated.marketingOptIn } };
  });

  // Remove a customer account: anonymized (orders kept for accounting),
  // same strategy as customer self-deletion.
  app.delete("/admin/users/:id", admin, async (request) => {
    const tenant = await getTenant();
    const { id } = request.params as { id: string };
    const user = await prisma.user.findFirst({ where: { id, tenantId: tenant.id } });
    if (!user) throw notFound("User not found");
    if (user.role !== "CUSTOMER") {
      throw badRequest("NOT_A_CUSTOMER", "Staff/owner accounts are managed in NYX SYS");
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { customerId: id, startsAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      }),
      prisma.device.deleteMany({ where: { userId: id } }),
      prisma.address.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.couponRedemption.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: {
          name: "Removed customer",
          email: `removed-${id}@removed.local`,
          phone: null,
          passwordHash: `removed:${id}`,
          marketingOptIn: false,
        },
      }),
    ]);
    return { ok: true };
  });

  // ---------- push broadcast ----------
  const pushInput = z.object({
    title: z.string().min(1).max(120),
    body: z.string().max(500).optional(),
    deeplink: z.string().max(200).nullable().optional(),
    marketing: z.boolean().default(true),
  });

  app.post("/admin/push", admin, async (request, reply) => {
    const tenant = await getTenant();
    const input = pushInput.parse(request.body);
    const msg = await prisma.pushMessage.create({
      data: {
        tenantId: tenant.id,
        title: input.title,
        body: input.body ?? "",
        deeplink: input.deeplink ?? null,
        createdById: request.user.sub,
        sentAt: new Date(),
      },
    });
    const audience = await broadcast(tenant.id, {
      title: input.title,
      body: input.body ?? null,
      deeplink: input.deeplink ?? null,
      marketing: input.marketing,
    });
    return reply.code(201).send({ message: msg.id, audienceSize: audience });
  });

  // ---------- settings / features / branding ----------
  app.patch("/admin/config", admin, async (request) => {
    const tenant = await getTenant();
    const input = z
      .object({
        settings: z.record(z.unknown()).optional(),
        features: z.record(z.unknown()).optional(),
        brand: z.record(z.unknown()).optional(),
        name: z.string().min(1).max(120).optional(),
      })
      .parse(request.body);

    const mergeInto = (current: unknown, patch?: Record<string, unknown>) =>
      patch === undefined ? undefined : ({ ...(current as object), ...patch } as object);

    const tenantUpdated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: input.name,
        settings: mergeInto(tenant.settings, input.settings),
        features: mergeInto(tenant.features, input.features),
        brand: mergeInto(tenant.brand, input.brand),
      },
    });
    return {
      tenant: {
        slug: tenantUpdated.slug,
        name: tenantUpdated.name,
        brand: tenantUpdated.brand,
        features: tenantUpdated.features,
        settings: tenantUpdated.settings,
      },
    };
  });
}
