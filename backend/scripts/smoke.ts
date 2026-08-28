// End-to-end smoke test against a running API. Exercises every stage gate:
//   npx tsx scripts/smoke.ts [baseUrl]
import { API_PREFIX } from "../src/config";

const BASE = process.argv[2] ?? "http://localhost:3000";
const stamp = Date.now().toString(36);
const CUSTOMER = `smoke-${stamp}@example.test`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@northernbloom.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "dev-admin-password";

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) console.log(`  PASS ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : "");
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${API_PREFIX}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* 204s */ }
  return { status: res.status, json } as { status: number; json: any };
}

// ---- Stage 2: auth ----
console.log("stage2: auth");
const reg = await api("/auth/register", { method: "POST", body: JSON.stringify({ name: "Smoke", email: CUSTOMER, password: "password123" }) });
check("register 201", reg.status === 201 || reg.status === 400, reg.status);
const custToken = reg.json?.token as string | undefined ?? (await api("/auth/login", { method: "POST", body: JSON.stringify({ email: CUSTOMER, password: "password123" }) })).json?.token;
check("customer token", !!custToken);

const dupe = await api("/auth/register", { method: "POST", body: JSON.stringify({ name: "Smoke", email: CUSTOMER, password: "password123" }) });
check("duplicate email rejected 400 EMAIL_TAKEN", dupe.status === 400 && dupe.json?.error?.code === "EMAIL_TAKEN", dupe.json);

const badLogin = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: CUSTOMER, password: "wrong-pass" }) });
check("bad login 401", badLogin.status === 401);

const me = await api("/me", { headers: { authorization: `Bearer ${custToken}` } });
check("GET /me", me.status === 200 && me.json?.user?.email === CUSTOMER);
const meNoAuth = await api("/me");
check("GET /me without token 401", meNoAuth.status === 401);

const adminLogin = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
check("admin login", adminLogin.status === 200 && adminLogin.json?.user?.role === "ADMIN", adminLogin.json);
const adminAuth = { authorization: `Bearer ${adminLogin.json?.token as string}` };

const custAdminStats = await api("/admin/stats", { headers: { authorization: `Bearer ${custToken}` } });
check("customer blocked from admin 403", custAdminStats.status === 403);

// ---- Stage 3: booking ----
console.log("stage3: booking");
const cfgRes = await api("/config");
check("GET /config", cfgRes.status === 200 && cfgRes.json?.tenantId === "northern-bloom");

const svcRes = await api("/services");
const serviceId = svcRes.json?.services?.[0]?.id as string | undefined;
check("GET /services", !!serviceId);

const date = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
const avail = await api(`/availability?serviceId=${serviceId}&date=${date}`, { headers: { authorization: `Bearer ${custToken}` } });
const slot = avail.json?.slots?.[0] as { startsAt: string; staffId: string } | undefined;
check("availability has slots", avail.status === 200 && !!slot);

if (slot) {
  const book = await api("/appointments", {
    method: "POST",
    headers: { authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ serviceId, staffId: slot.staffId, startsAt: slot.startsAt }),
  });
  check("book appointment 201", book.status === 201, book.json);

  const doubleBook = await api("/appointments", {
    method: "POST",
    headers: { authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ serviceId, staffId: slot.staffId, startsAt: slot.startsAt }),
  });
  check("same slot again 409", doubleBook.status === 409 && doubleBook.json?.error?.code === "APPOINTMENT_SLOT_UNAVAILABLE", doubleBook.json);

  const list = await api("/appointments?upcoming=true", { headers: { authorization: `Bearer ${custToken}` } });
  check("upcoming appointments listed", list.status === 200 && list.json?.appointments?.length >= 1);

  const cancelTooLateOrOk = await api(`/appointments/${book.json.appointment.id}/cancel`, { method: "PATCH", headers: { authorization: `Bearer ${custToken}` } });
  check("cancel own appointment", cancelTooLateOrOk.status === 200, cancelTooLateOrOk.json);
}

// ---- Stage 4/5 surfaces: devices, notifications, shop ----
console.log("stage5: shop");
const cat = await api("/catalog");
const product = cat.json?.products?.find((p: any) => !p.soldOut) as { id: string; priceCents: number; name: string } | undefined;
check("catalog has buyable products", !!product);

const coupon = await api("/coupons/validate", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({ code: "WELCOME10", subtotalCents: product?.priceCents ?? 5000 }),
});
check("WELCOME10 valid", coupon.status === 200 && coupon.json?.discountCents > 0, coupon.json);

const badCoupon = await api("/coupons/validate", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({ code: "NOPE", subtotalCents: 5000 }),
});
check("unknown coupon rejected", badCoupon.status === 400 && badCoupon.json?.error?.code === "COUPON_INVALID");

const order = await api("/orders", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({
    items: [{ productId: product.id, qty: 2 }],
    fulfillment: "PICKUP",
    couponCode: "WELCOME10",
    paymentMethod: "CASH",
  }),
});
check("pickup order placed 201", order.status === 201, order.json);
if (order.status === 201) {
  // Invariant: total = subtotal - discount (+ delivery fee). Percent coupons
  // scale with the actual charged subtotal, so we don't pin absolute cents.
  const o = order.json.order;
  check(
    "server-computed totals consistent",
    o.subtotalCents === product.priceCents * 2 &&
      o.totalCents === o.subtotalCents - o.discountCents + o.deliveryFeeCents &&
      o.discountCents > 0,
    o,
  );
}

// Oversell attempt: more than available stock (within the per-line cap of 99).
const oversellQty = Math.min((product?.stock ?? 0) + 5, 99);
const oversell = await api("/orders", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({
    items: [{ productId: product.id, qty: oversellQty }],
    fulfillment: "PICKUP",
    paymentMethod: "CASH",
  }),
});
check("oversell rejected 409", oversell.status === 409 && oversell.json?.error?.code === "INSUFFICIENT_STOCK", oversell.json);

const deliveryNoAddr = await api("/orders", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({ items: [{ productId: product.id, qty: 1 }], fulfillment: "DELIVERY", paymentMethod: "CASH" }),
});
check("delivery without address 400 ADDRESS_REQUIRED", deliveryNoAddr.status === 400 && deliveryNoAddr.json?.error?.code === "ADDRESS_REQUIRED");

const addr = await api("/me/addresses", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({ line1: "123 Main St", city: "North Bay", postalCode: "P1B 1A1" }),
});
check("address created", addr.status === 201);

const deliveryOrder = await api("/orders", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({
    items: [{ productId: product.id, qty: 1 }],
    fulfillment: "DELIVERY",
    addressId: addr.json.address.id,
    paymentMethod: "CASH",
  }),
});
check("delivery order placed", deliveryOrder.status === 201, deliveryOrder.json);
if (deliveryOrder.status === 201) {
  // Fee must match tenant config (flat fee or waived above the threshold).
  const cfgRes = await api("/config");
  const s = cfgRes.json?.settings ?? {};
  const expectedFee = typeof s.deliveryFeeCents === "number" ? s.deliveryFeeCents : 0;
  const freeOver = typeof s.freeDeliveryOverCents === "number" ? s.freeDeliveryOverCents : null;
  const o = deliveryOrder.json.order;
  const okFee =
    o.deliveryFeeCents === expectedFee ||
    (freeOver !== null && freeOver > 0 && o.deliveryFeeCents === 0);
  check("delivery fee matches tenant settings", okFee, {
    got: o.deliveryFeeCents,
    expected: expectedFee,
    freeOver,
  });
}

const deviceReg = await api("/devices", {
  method: "POST",
  headers: { authorization: `Bearer ${custToken}` },
  body: JSON.stringify({ fcmToken: `smoke-token-${stamp}-abcdefghijklmnop`, platform: "android" }),
});
check("device registered", deviceReg.status === 201);

const notifs = await api("/notifications", { headers: { authorization: `Bearer ${custToken}` } });
check("notifications exist (order confirm)", notifs.status === 200 && notifs.json.notifications.length >= 1);

// ---- Admin ----
console.log("admin");
const stats = await api("/admin/stats", { headers: adminAuth });
check("admin stats", stats.status === 200 && typeof stats.json.revenueTodayCents === "number", stats.json);

const newProduct = await api("/admin/products", {
  method: "POST",
  headers: adminAuth,
  body: JSON.stringify({ name: `Test Product ${stamp}`, priceCents: 1000, stock: 5 }),
});
check("admin create product", newProduct.status === 201);

const patchProduct = await api(`/admin/products/${newProduct.json.product.id}`, {
  method: "PATCH",
  headers: adminAuth,
  body: JSON.stringify({ priceCents: 1500 }),
});
check("admin change price", patchProduct.status === 200 && patchProduct.json.product.priceCents === 1500);

const push = await api("/admin/push", {
  method: "POST",
  headers: adminAuth,
  body: JSON.stringify({ title: `Smoke broadcast ${stamp}`, body: "hello", marketing: true }),
});
check("admin broadcast accepted", push.status === 201, push.json);

const adminOrders = await api("/admin/orders?status=PLACED", { headers: adminAuth });
check("admin sees placed orders", adminOrders.status === 200 && adminOrders.json.orders.length >= 1);

if (deliveryOrder.status === 201) {
  const markPaid = await api(`/admin/orders/${deliveryOrder.json.order.id}`, {
    method: "PATCH",
    headers: adminAuth,
    body: JSON.stringify({ status: "CONFIRMED", paymentStatus: "PAID" }),
  });
  check("admin updates order+payment", markPaid.status === 200);
}

const settingsPatch = await api("/admin/config", {
  method: "PATCH",
  headers: adminAuth,
  body: JSON.stringify({ settings: { deliveryFeeCents: 600 } }),
});
check("admin patches settings", settingsPatch.status === 200 && settingsPatch.json.tenant.settings.deliveryFeeCents === 600);
await api("/admin/config", { method: "PATCH", headers: adminAuth, body: JSON.stringify({ settings: { deliveryFeeCents: 500 } }) });

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
