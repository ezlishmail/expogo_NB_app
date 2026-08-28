# NYX SYS Mobile — Operations Manual

Your reference for running, branding, onboarding clients, and shipping.
Last updated: 2026-08-25.

---

## 1. The big picture

```
NYX SYS platform
├── Desktop (Electron + SQLite)     ← counter ops + staff portal (exists, untouched)
├── Booking website (Next.js)       ← Cloudflare Pages (exists, untouched)
├── THIS REPO
│   ├── backend/    Fastify + Prisma REST API on Neon Postgres  ← mobile's brain
│   ├── admin/      Owner dashboard (React) — full control center
│   ├── mobile/     Expo app = CUSTOMER app + OWNER console  ← the one true app
│   ├── android/    (reference native build, not maintained)
│   └── ios/        (reference native build, not maintained)
└── Neon Postgres                   ← shared data layer
```

**The mobile app is booking-first**: services → stylist → day → time → booked,
plus booking history, and a store slot for salon products. Owners get an
in-app console (stats, today's book, customers, staff bookability).

---

## 2. Demo accounts & roles

| Account | Email | Password | What it sees |
|---|---|---|---|
| **Demo customer** | `demo@northernbloom.app` | `Demo@12345` | Book, store, orders, profile |
| **Salon owner** | `owner@northernbloom.app` | `Owner@12345` | Everything above **+ Admin tab** (stats, today's book, customers, staff) |
| Dashboard admin | `admin@northernbloom.test` | `dev-admin-password` | Web dashboard only (`admin/`, port 5173) |

Role model mirrors NYX SYS: `CUSTOMER · STAFF · COUNTER · OWNER · DEVELOPER`.
Manager powers (admin API + in-app Admin tab) = `OWNER`, `ADMIN`, `DEVELOPER`.
Staff/counter accounts belong to the desktop portal — this app never manages
them beyond bookability (on/off).

> Change these passwords before anything real: they're in `backend/.env` as
> `OWNER_PASSWORD` / `DEMO_PASSWORD` / `ADMIN_PASSWORD` (defaults in seed).

---

## 3. The template/branding system

**Everything visual and behavioral is tenant data, not app code.** One row in
the `tenants` table drives the whole app:

```
tenants
├── brand     → name, tagline, logoUrl, primaryColor, accentColor
├── features  → appointments, shopping, delivery, pickup, coupons   (tab switches)
└── settings  → currency, timezone, deliveryFeeCents, freeDeliveryOverCents,
                address, phone, upiId, openingHours,
                reminderHours [24,2], minCancelNoticeMin, maxAdvanceDays
```

Flow: this row → `GET /api/v1/config` → the app themes itself (colors),
builds its tab bar (feature flags), formats money (₹ / en-IN), and shows
business info. **Change the row, the app changes. No app update needed.**

**Change branding right now:** admin dashboard → Settings → edit name/phone/
address/fees → Save. Colors/features: `PATCH /api/v1/admin/config` with e.g.

```json
{ "brand": { "primaryColor": "#7C3AED", "accentColor": "#F59E0B" } }
```

**The three things that are NOT runtime-swappable** (they live in the binary):
app name under the icon, splash image, package/bundle ID. Set per client at
build time (see §5).

---

## 4. Onboarding a new salon (client #002)

The API currently runs one tenant per deployment (`TENANT_SLUG` env).
Second salon = second deployment + new tenant row. Steps:

1. **Create the tenant** (SQL on Neon, or add to seed):
   ```sql
   INSERT INTO tenants (id, slug, name, brand, features, settings, "createdAt")
   VALUES (gen_random_uuid(), 'glow-studio', 'Glow Studio',
     '{"name":"Glow Studio","tagline":"Hair & Beauty","primaryColor":"#7C3AED","accentColor":"#F472B6"}',
     '{"appointments":true,"shopping":false,"delivery":false,"pickup":true,"coupons":true}',
     '{"currency":"INR","timezone":"Asia/Kolkata","deliveryFeeCents":0,"address":"...","phone":"...","reminderHours":[24,2],"minCancelNoticeMin":120,"maxAdvanceDays":30}',
     now());
   ```
2. **Deploy a second API instance** (Railway/Fly) with `TENANT_SLUG=glow-studio`
   and its own `JWT_SECRET`. Same code, same migration — `prisma migrate deploy`.
3. **Seed its catalog**: create services/staff via the dashboard (it edits the
   tenant from `TENANT_SLUG`), or SQL. Your NYX SYS 117 services can be
   exported from SQLite → INSERT scripts when a salon needs them.
4. **Owner account**: register normally, then `UPDATE users SET role='OWNER'`
   (or add `OWNER_EMAIL` to seed).
5. **Build their app**: `EXPO_PUBLIC_API_URL=https://glow-api.ups.com/api/v1`
   + new `name`/`bundleIdentifier` in `app.json` → EAS build profile (§5).
   Their colors/logo come from the tenant row automatically.

Adding services/staff later: dashboard → Services/Staff tabs. No app release.

---

## 5. Making & shipping changes

### Mobile (Expo — the one true app)

```powershell
# daily loop
cd mobile
npx expo start            # test in Expo Go on your phone

# ship it (same JS codebase → native binaries in Expo's cloud)
npm i -g eas-cli
eas login
eas build:configure       # one time; creates eas.json

# iOS (needs $99/yr Apple Developer account)
eas build -p ios --profile production     # signed IPA, cloud macOS
eas submit -p ios --latest                # → TestFlight → App Store

# Android ($25 one-time Google Play fee)
eas build -p android --profile production # signed AAB
eas submit -p android --latest            # → Play Console
```

Per-client white-label builds: add a build profile per salon in `eas.json`
(different `appName`, `bundleIdentifier`/`package`, and
`EXPO_PUBLIC_API_URL` env). One repo → N branded store apps.

### Backend

```powershell
cd backend
npm run typecheck
npx tsx scripts/smoke.ts http://localhost:3000        # must stay green
git push → Railway/Fly auto-deploy (or their CLI)
# schema changes: prisma migrate dev locally, then on deploy:
npx prisma migrate deploy
```

### Admin dashboard

`npm run build` in `admin/` → upload `dist/` to Vercel/Netlify (free).
Point it at the deployed API (Vite env `VITE_` proxy or set the API URL).

---

## 6. Payments — the UPI pattern

**Rule: static UPI QR / pay-at-counter. No gateways, no fees.**

Current behavior: checkout says "Pay at salon · UPI / Cash"; the order is
created `UNPAID` and the owner marks it paid (dashboard → Orders → Mark paid,
or in-app console when order flows through). `settings.upiId` is already in
the tenant config for when you want an in-app QR screen — render
`upi://pay?pa=<upiId>&am=<total>&cu=INR` as a QR and verify payment manually
against the bank statement, same as the counter QR. The `payments` table has
a `UPI` method and `providerRef` for that day.

---

## 7. The store (reserved slot)

Already architected, currently on: products, categories, stock tracking,
coupons, cart, checkout, delivery fee + free-over-threshold. Toggle the whole
tab per salon with `features.shopping` (dashboard → Settings → Features).
Salon products are seeded as demo stock; replace via dashboard → Products.

---

## 8. Booking rules (no code changes needed)

`PATCH /api/v1/admin/config` with `settings`:

| Key | Meaning | Default |
|---|---|---|
| `reminderHours` | reminders sent N hours before | `[24, 2]` |
| `minCancelNoticeMin` | customer can't cancel inside this window | `120` |
| `maxAdvanceDays` | how far ahead booking opens | `30` |
| `openingHours` | per-day hours (staff availability gates slots) | Mon–Sat 10:00–19:30 |

Double-booking is **impossible by database constraint** — two phones racing
for one slot: exactly one wins, the rest get a clean "slot unavailable".

---

## 9. Push notifications

- Set `FCM_SERVICE_ACCOUNT_JSON` (raw service-account JSON) in backend env →
  FCM HTTP v1 delivery. Without it: notifications still appear in-app.
- Automatic: booking confirmations, cancellations, reschedules, order status,
  24h/2h reminders (cron every 5 min).
- Manual: dashboard → Push (respects marketing opt-outs).
- Expo Go can't receive pushes; they work in dev/production builds.

---

## 10. Environments & secrets

`backend/.env` (never commit):

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Neon direct (migrations) — has `connect_timeout=15` for cold starts |
| `SHADOW_DATABASE_URL` | Neon shadow DB for migrations |
| `JWT_SECRET` | **must be a long random string in production** |
| `TENANT_SLUG` | which tenant this deployment serves |
| `OWNER_PASSWORD` / `DEMO_PASSWORD` / `ADMIN_PASSWORD` | seed account passwords |
| `FCM_SERVICE_ACCOUNT_JSON` | push delivery |
| `CORS_ORIGIN` | dashboard origin |

Mobile env: `EXPO_PUBLIC_API_URL` (production API URL; local testing
auto-detects your PC's LAN IP).

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| App hangs on splash in Expo Go | Firewall rule missing: `New-NetFirewallRule -DisplayName "NB Dev" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,8081` (admin PowerShell, once) |
| "Project incompatible with Expo Go" | `npx expo install expo@latest` + `npx expo install --fix` — Expo Go only runs the newest SDK |
| Random `Can't reach database server` | Neon free tier sleeps after 5 min idle; first request wakes it (`connect_timeout=15` already set). Upgrade Neon plan when live. |
| Phone can't reach PC | Same WiFi, guest networks isolate devices; check PC IP changed (`ipconfig`) — Expo prints the current one |
| 401 after backend restart with new `JWT_SECRET` | Expected — log in again |

---

## 12. Repo hygiene

- `mobile/` is the maintained app. `android/` + `ios/` are kept as native
  reference implementations — do not invest in them.
- After any backend change: `npm run typecheck && npx tsx scripts/smoke.ts`.
- Booking race gate: `npx tsx scripts/test-booking-concurrency.ts` — must
  always report `created=1`.
