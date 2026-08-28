# Northern Bloom — customer app platform

Monorepo for the Northern Bloom customer apps (Android + iOS), their backend
API, and the owner's admin dashboard. Built tenant-aware from day one
(`tenant_id` on every business table + one `tenants` row) so a second client
is config work, not a rewrite. See `docs/architecture.md`.

## Layout

```
backend/    Fastify + Prisma + Postgres (Neon) REST API  ← source of truth
admin/      React + Vite + Tailwind dashboard            (owner control center)
mobile/     Expo Go app — test on real phone NOW         (iOS + Android)
android/    Kotlin + Compose native app                  (reference only, unmaintained)
ios/        SwiftUI native app                           (reference only, unmaintained)
tools/      NYX SYS SQLite export scripts
docs/       architecture decisions
```

## Backend quickstart

```powershell
cd backend
npm install
copy .env.example .env      # then paste your Neon DATABASE_URL
npx prisma migrate deploy   # or: npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000/api/v1/health
```

Seed creates the owner login (`admin@northernbloom.test`, password via
`ADMIN_PASSWORD` env, default `dev-admin-password` — set a real one before
deploying) plus demo services/staff/products/coupon.

Optional env for real push delivery: paste a Firebase service-account JSON as
`FCM_SERVICE_ACCOUNT_JSON`. Without it, notifications are still stored in-app.

## Verify

```powershell
cd backend
npm run typecheck
npx tsx scripts/smoke.ts http://localhost:3000                      # full API e2e
npx tsx scripts/test-booking-concurrency.ts http://localhost:3000   # 20-way booking race
```

## Admin dashboard

```powershell
cd admin
npm install
npm run dev                 # http://localhost:5173 (proxies /api → :3000)
```

Login with the seeded owner account. Covers stats, appointments, orders,
services, staff (+availability), products, categories, coupons, push
broadcast, and business settings/features.

## Stages

- [x] Stage 1 — skeleton + schema + health
- [x] Stage 2 — auth (register/login/me, anonymized deletion, admin guard)
- [x] Stage 3 — booking (+ concurrency gate: exactly 1×201 / rest 409 under 20-way race)
- [x] Stage 4 — push (FCM HTTP v1 zero-dep sender, devices, reminders cron, broadcast)
- [x] Stage 5 — shop/checkout (server-side totals, atomic stock decrement, coupons)
- [x] Stage 6 — admin dashboard
- [x] Stage 7 — customer app ships from `mobile/` (Expo) via EAS build/submit
- [ref] `android/` (Kotlin + Compose) & `ios/` (SwiftUI) — **unmaintained reference builds only**, not the shipping path (see docs/MANUAL.md §12)

## Mobile app

The shipping customer app is `mobile/` (Expo, managed) — test in Expo Go now,
ship with EAS build/submit (see docs/MANUAL.md §5). It is white-label by design:
the only tenant-specific value compiled in is the API base URL; branding colors,
logo, feature flags, catalog, hours and fees all come from `GET /config`, and
bottom tabs adapt to enabled features at runtime.

The `android/` (Kotlin + Compose) and `ios/` (SwiftUI) folders are **unmaintained
reference builds** — do not invest in them; they are not part of the ship path.

| Piece | Where |
|---|---|
| Android | `android/` — open in Android Studio (Gradle sync), or copy `tenant.properties.example` → `tenant.properties` |
| iOS | `ios/` — `xcodegen && open NorthernBloom.xcodeproj`; see `ios/README.md` |

Deep links on both platforms: `nbcustomer://open/product/{id}`,
`nbcustomer://open/order/{id}` (push data messages route through the same
router).
