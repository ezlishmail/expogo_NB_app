// Northern Bloom Salon (Kathua, J&K) — tenant #001 of NYX SYS.
// Money = integer paise. Currency INR, timezone Asia/Kolkata.
//
// Real catalog + team are imported from the repo-root data files
// (services-catalog.json, staff-roster.json). Re-running is safe: the tenant
// and accounts upsert; the catalog is (re)built only while the service table
// still holds a demo-sized set (< REAL_SERVICE_MIN) or when RESEED_CATALOG=1.
// Once the real ~170-service catalog is in, later runs leave admin edits alone.
import { readFileSync } from "node:fs";
import { PrismaClient, Gender } from "@prisma/client";
import argon2 from "@node-rs/argon2";

const prisma = new PrismaClient();

// ---------- tenant config (single source of truth for every app) ----------
const brand = {
  name: "Northern Bloom",
  tagline: "Salon & Studio",
  // logoUrl null = apps fall back to their bundled brand logo. Set this to a
  // hosted https URL via the admin dashboard (Settings → Brand) to swap the
  // in-app logo everywhere with no rebuild. App icon/splash are baked into the
  // native build and are NOT driven by this field.
  logoUrl: null,
  primaryColor: "#1C1A17", // deep ink — primary CTAs (white text stays AA)
  accentColor: "#C9A84C", // gold — brand accent / highlights
};

const features = {
  appointments: true,
  shopping: true, // in-app store — owner uploads the product roster via admin
  delivery: true,
  pickup: true,
  coupons: true,
};

const settings = {
  currency: "INR",
  timezone: "Asia/Kolkata",
  deliveryFeeCents: 4900, // ₹49
  freeDeliveryOverCents: 59900, // free over ₹599
  pickupEnabled: true,
  address: "Main Bazar, Kathua, Jammu & Kashmir 184104",
  phone: "+91 98777 13197",
  upiId: "northernbloom@ybl", // static UPI QR pattern — hidden until online pay is enabled
  reminderHours: [24, 2],
  minCancelNoticeMin: 120,
  maxAdvanceDays: 30,
  // Payments v1: Cash on Delivery / pay-at-counter only. The online gateway is
  // a placeholder — flip onlinePaymentEnabled + wire a provider when ready.
  codEnabled: true,
  codChargeCents: 0, // owner-set COD/handling surcharge in paise (₹0 = none)
  onlinePaymentEnabled: false,
  // Mon–Sun 10:30 AM – 8:00 PM (matches the live site northernbloom.in).
  openingHours: {
    mon: "10:30-20:00", tue: "10:30-20:00", wed: "10:30-20:00", thu: "10:30-20:00",
    fri: "10:30-20:00", sat: "10:30-20:00", sun: "10:30-20:00",
  },
};

const tenant = await prisma.tenant.upsert({
  where: { slug: "northern-bloom" },
  update: { name: "Northern Bloom", brand, features, settings },
  create: { slug: "northern-bloom", name: "Northern Bloom", brand, features, settings },
});

console.log("Seeded tenant:", tenant.slug, tenant.id);

// ---------- accounts ----------
// Owner (in-app admin mode + dashboard) + demo customer + dashboard admin.
// These are DEMO / setup credentials, surfaced on the sign-in screens; the real
// owner replaces them with their own account before launch.
const accounts: Array<{ email: string; password: string; name: string; role: "OWNER" | "ADMIN" | "CUSTOMER" }> = [
  { email: "owner@northernbloom.app", password: process.env.OWNER_PASSWORD ?? "Owner@12345", name: "Salon Owner", role: "OWNER" },
  { email: "demo@northernbloom.app", password: process.env.DEMO_PASSWORD ?? "Demo@12345", name: "Demo Customer", role: "CUSTOMER" },
  { email: "admin@northernbloom.test", password: process.env.ADMIN_PASSWORD ?? "dev-admin-password", name: "Dashboard Admin", role: "ADMIN" },
];

for (const acc of accounts) {
  const passwordHash = await argon2.hash(acc.password);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: acc.email } },
    update: { role: acc.role, name: acc.name },
    create: {
      tenantId: tenant.id,
      role: acc.role,
      name: acc.name,
      email: acc.email,
      passwordHash,
      marketingOptIn: acc.role === "CUSTOMER",
    },
  });
  console.log(`Seeded ${acc.role}:`, acc.email);
}

// ---------- catalog (real data import) ----------
type CatalogRow = { service_id: number; name: string; category: string; price: number; duration_mins: number };
type RosterRow = {
  name: string;
  staffId: number | null;
  active: boolean;
  bookable?: boolean;
  experienceYears: number;
  rating: number;
  bio: string;
  categories: string[];
  photoUrl: string;
};

const catalog: CatalogRow[] = JSON.parse(
  readFileSync(new URL("../../services-catalog.json", import.meta.url), "utf-8"),
);
const roster: RosterRow[] = JSON.parse(
  readFileSync(new URL("../../staff-roster.json", import.meta.url), "utf-8"),
);

// Professional display order for service categories. Anything not listed is
// appended after these, so a new catalog category never gets dropped.
const CATEGORY_ORDER = [
  "Hair Cut", "Hair Color", "Hair Spa", "Hair Treatment", "Hairstyle", "Advance Hairstyle", "Oiling",
  "Ladies Hair",
  "Facial O3+", "Facial Skinora", "Facial Aromamagic", "Facial Lotus", "Facial Cleanup",
  "Bleach", "D-Tan", "Face Wax", "Body Wax", "Threading",
  "Manicure", "Pedicure", "Mani+Pedi", "Nail Extensions",
  "Massage", "Makeup", "Gents",
];

// forGender: which clientele a service is for. null = everyone.
const MALE_CATEGORIES = new Set(["Gents"]);
const FEMALE_CATEGORIES = new Set(["Ladies Hair"]);
const forGenderOf = (category: string): Gender | null =>
  MALE_CATEGORIES.has(category) ? Gender.MALE : FEMALE_CATEGORIES.has(category) ? Gender.FEMALE : null;

// Fixed-price makeup bundles (from the live site; not in the raw catalog).
// Inclusions are placeholder copy the owner refines in the admin panel.
const MAKEUP_PACKAGES = [
  { name: "Classic Makeup", priceCents: 300_000, durationMin: 60, description: "Classic party/day look — base, eyes, lips and setting. Inclusions editable in admin." },
  { name: "Signature Makeup", priceCents: 350_000, durationMin: 75, description: "Signature glam with lashes and a long-wear finish. Inclusions editable in admin." },
  { name: "Luxury High-End Makeup", priceCents: 550_000, durationMin: 120, description: "Premium HD/airbrush look with a pre-event trial. Inclusions editable in admin." },
];

// Broad staff specialty (roster) → the granular service categories they cover.
const SPECIALTY_TO_SERVICE_CATEGORIES: Record<string, string[]> = {
  Hair: ["Hair Cut", "Hair Color", "Hair Spa", "Hair Treatment", "Hairstyle", "Advance Hairstyle", "Oiling", "Ladies Hair"],
  Gents: ["Gents"],
  Skin: ["Facial O3+", "Facial Skinora", "Facial Aromamagic", "Facial Lotus", "Facial Cleanup", "Bleach", "D-Tan", "Face Wax", "Body Wax", "Threading", "Massage"],
  Bridal: ["Makeup"],
  Nails: ["Nail Extensions", "Manicure"],
  Pedicure: ["Pedicure", "Mani+Pedi"],
};

const REAL_SERVICE_MIN = 150; // real catalog is ~170; any demo set is far smaller
const existingServices = await prisma.service.count({ where: { tenantId: tenant.id } });
const forceReseed = process.env.RESEED_CATALOG === "1";
const needsRebuild = forceReseed || existingServices < REAL_SERVICE_MIN;

if (needsRebuild) {
  console.log(
    forceReseed
      ? "RESEED_CATALOG=1 — rebuilding catalog from data files…"
      : `Demo/empty catalog (${existingServices} services) — importing real catalog…`,
  );
  // Wipe the tenant's catalog + anything referencing it, then re-import.
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { user: { tenantId: tenant.id } } }),
    prisma.couponRedemption.deleteMany({ where: { coupon: { tenantId: tenant.id } } }),
    prisma.payment.deleteMany({ where: { order: { tenantId: tenant.id } } }),
    prisma.orderItem.deleteMany({ where: { order: { tenantId: tenant.id } } }),
    prisma.order.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.appointment.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.pushMessage.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.staffAvailability.deleteMany({ where: { staff: { tenantId: tenant.id } } }),
    prisma.timeOff.deleteMany({ where: { staff: { tenantId: tenant.id } } }),
    prisma.staffService.deleteMany({ where: { staff: { tenantId: tenant.id } } }),
    prisma.staff.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.stockAdjustment.deleteMany({ where: { product: { tenantId: tenant.id } } }),
    prisma.service.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.product.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.productCategory.deleteMany({ where: { tenantId: tenant.id } }),
  ]);

  // Build services in professional category order, sortOrder = global index.
  const orderedCategories = [
    ...CATEGORY_ORDER,
    ...[...new Set(catalog.map((r) => r.category))].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  let sortOrder = 0;
  const serviceRows = [];
  for (const category of orderedCategories) {
    if (category === "Makeup") {
      for (const p of MAKEUP_PACKAGES) {
        serviceRows.push({
          tenantId: tenant.id, name: p.name, category, description: p.description,
          durationMin: p.durationMin, priceCents: p.priceCents, forGender: null, sortOrder: sortOrder++, active: true,
        });
      }
      continue;
    }
    for (const r of catalog.filter((row) => row.category === category)) {
      serviceRows.push({
        tenantId: tenant.id, name: r.name, category, description: null,
        durationMin: r.duration_mins, priceCents: r.price * 100, // rupees → paise
        forGender: forGenderOf(category), sortOrder: sortOrder++, active: true,
      });
    }
  }
  await prisma.service.createMany({ data: serviceRows });
  console.log(`Seeded ${serviceRows.length} services (${catalog.length} catalog + ${MAKEUP_PACKAGES.length} makeup packages)`);

  // Map each service category → its service ids, for staff bookability links.
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, category: true },
  });
  const idsByCategory = new Map<string, string[]>();
  for (const s of services) {
    if (!s.category) continue;
    const arr = idsByCategory.get(s.category) ?? [];
    arr.push(s.id);
    idsByCategory.set(s.category, arr);
  }

  // Import active, bookable staff only. Gender is intentionally left null —
  // it's set per-stylist in the admin panel (never guessed from a name), and
  // drives the male/female stylist filter once populated.
  const activeStaff = roster.filter((r) => r.active && r.bookable !== false);
  for (const member of activeStaff) {
    const serviceCategories = new Set<string>();
    for (const specialty of member.categories) {
      for (const cat of SPECIALTY_TO_SERVICE_CATEGORIES[specialty] ?? []) serviceCategories.add(cat);
    }
    const serviceIds = [...serviceCategories].flatMap((cat) => idsByCategory.get(cat) ?? []);
    const photoUrl = member.photoUrl?.trim() ? member.photoUrl.trim() : null;

    await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: member.name,
        bio: member.bio || null,
        active: true,
        gender: null,
        photoUrl, // NOTE: Google Drive links — rehost to owned storage before launch
        specialties: member.categories,
        // Mon–Sun 10:30–20:00 (weekday 0=Sun … 6=Sat, minutes since midnight).
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 630, endMin: 1200 })) },
        staffServices: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });
  }
  console.log(`Seeded ${activeStaff.length} active staff (${roster.length - activeStaff.length} inactive excluded)`);

  // Retail products: placeholder stock so Shop isn't empty during testing.
  // The owner replaces these with the real roster via the admin dashboard.
  const hairCare = await prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Hair Care", sortOrder: 1 } });
  const skinCare = await prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Skin Care", sortOrder: 2 } });
  await prisma.product.createMany({
    data: [
      { tenantId: tenant.id, categoryId: hairCare.id, name: "Keratin Repair Shampoo", priceCents: 64900, stock: 25, featured: true, description: "Sulphate-free, for treated hair. (Placeholder — replace via admin.)" },
      { tenantId: tenant.id, categoryId: hairCare.id, name: "Argan Hair Serum", priceCents: 89900, stock: 18, featured: true, description: "Frizz control & shine. (Placeholder — replace via admin.)" },
      { tenantId: tenant.id, categoryId: skinCare.id, name: "Vitamin C Face Wash", priceCents: 44900, stock: 40, description: "Brightening daily cleanser. (Placeholder — replace via admin.)" },
      { tenantId: tenant.id, categoryId: skinCare.id, name: "Hydra Sunscreen SPF 50", priceCents: 59900, stock: 22, description: "No white cast, gel texture. (Placeholder — replace via admin.)" },
    ],
  });
  console.log("Seeded placeholder retail products");
}

const couponCount = await prisma.coupon.count({ where: { tenantId: tenant.id } });
if (couponCount === 0) {
  await prisma.coupon.create({
    data: {
      tenantId: tenant.id,
      code: "WELCOME10",
      kind: "PERCENT",
      value: 10,
      minOrderCents: 50000, // ₹500
      maxPerUser: 1,
      active: true,
    },
  });
}

await prisma.$disconnect();
