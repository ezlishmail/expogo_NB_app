import { Prisma, type Coupon } from "@prisma/client";

export interface CouponCheck {
  ok: boolean;
  code: string;
  reason?: string;
  discountCents: number;
}

export function computeDiscount(coupon: Coupon, subtotalCents: number): CouponCheck {
  const now = Date.now();
  if (!coupon.active) return fail("COUPON_INACTIVE");
  if (coupon.startsAt && now < coupon.startsAt.getTime()) return fail("COUPON_NOT_STARTED");
  if (coupon.expiresAt && now > coupon.expiresAt.getTime()) return fail("COUPON_EXPIRED");
  if (subtotalCents < coupon.minOrderCents) return fail("COUPON_MIN_ORDER");

  let discountCents: number;
  if (coupon.kind === "PERCENT") {
    discountCents = Math.floor((subtotalCents * coupon.value) / 100);
  } else {
    discountCents = coupon.value;
  }
  discountCents = Math.min(discountCents, subtotalCents);
  return { ok: true, code: coupon.code, discountCents };

  function fail(reason: string): CouponCheck {
    return { ok: false, code: coupon.code, reason, discountCents: 0 };
  }
}

export function computeTotals(opts: {
  subtotalCents: number;
  discountCents: number;
  fulfillment: "PICKUP" | "DELIVERY";
  settings: Prisma.JsonValue;
}): { deliveryFeeCents: number; codChargeCents: number; totalCents: number } {
  const s = (opts.settings ?? {}) as Record<string, unknown>;
  const fee = typeof s.deliveryFeeCents === "number" ? s.deliveryFeeCents : 0;
  const freeOver = typeof s.freeDeliveryOverCents === "number" ? s.freeDeliveryOverCents : null;

  let deliveryFeeCents = 0;
  if (opts.fulfillment === "DELIVERY") {
    const discounted = opts.subtotalCents - opts.discountCents;
    deliveryFeeCents = freeOver !== null && freeOver > 0 && discounted >= freeOver ? 0 : fee;
  }

  // Payments v1 is COD/pay-at-counter only, so the owner-set handling charge
  // applies to every order. Defaults to ₹0 (no surcharge) until they set one.
  const codEnabled = s.codEnabled !== false;
  const codChargeCents = codEnabled && typeof s.codChargeCents === "number" ? Math.max(0, s.codChargeCents) : 0;

  return {
    deliveryFeeCents,
    codChargeCents,
    totalCents: Math.max(0, opts.subtotalCents - opts.discountCents + deliveryFeeCents + codChargeCents),
  };
}
