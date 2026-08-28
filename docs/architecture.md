# Architecture (v1)

Decided 2026-08-24. Source of truth for structure: `backend/prisma/schema.prisma`.

## Decisions

- **Backend is the source of truth.** NYX SYS (offline Electron+SQLite) gets a
  one-time data export into Postgres; nothing talks to SQLite at runtime.
  Appointments cut over to this backend — no split-brain booking.
- **Multi-tenant insurance only:** every business table has `tenant_id` plus one
  `tenants` row. No RBAC, audit logs, segments, loyalty, funnels until client #2
  or real need. Deferred list at bottom.
- **No business content in app source:** branding, features, catalog, hours,
  delivery fees all come from `GET /config` + catalog endpoints. Feature flags
  drive Android bottom-nav tabs.

## Stack

| Piece | Choice |
|---|---|
| API | Node 20+, Fastify 5, TypeScript (run via tsx), zod validation |
| DB | Postgres on Neon (free tier), Prisma ORM |
| Auth | argon2 password hash, JWT access token (30d), HTTPS only |
| Push | FCM; devices table keyed by fcm_token, many per user |
| Payments | v1 = cash (owner marks paid). `payments` table provider-agnostic; Stripe later via webhook verification |
| Admin | React + Vite + Tailwind SPA, same API, role=admin middleware |
| Hosting | Fly.io or Railway for API; Vercel/Netlify free for admin |

## Data model highlights

Full definitions in `backend/prisma/schema.prisma`. Notable points:

- `appointments`: overlap prevented by a Postgres **exclusion constraint**
  (`btree_gist`, `tsrange` over naive `timestamp(3)` columns) on
  `(staffId, [startsAt, endsAt))` where status is active. Concurrency-safe;
  see `backend/prisma/exclusion-constraint.sql`, applied as part of the init
  migration.
- Money stored as integer cents everywhere.
- Orders snapshot item name/price + delivery address at purchase time.
- Coupons validated server-side; totals computed server-side, never trusted
  from clients.
- Rescheduling keeps status CONFIRMED (no separate RESCHEDULED state).
- Tables are snake_case, columns camelCase (Prisma default mapping).

## API surface (`/api/v1`)

Errors always `{ "error": { "code", "message" } }`.

Customer:
```
POST /auth/register  POST /auth/login        GET/PATCH /me     DELETE /me
GET  /config         GET /catalog            GET /services     GET /staff
GET  /availability?serviceId&staffId&date
POST /appointments   GET /appointments       PATCH /appointments/:id/cancel
PATCH /appointments/:id                      (reschedule)
POST /coupons/validate
POST /orders         GET /orders             GET /orders/:id
POST /devices        GET /notifications      PATCH /notifications/:id/read
```

Admin (role enforced server-side): CRUD `/admin/{services,staff,products,categories,coupons}`,
appointment management under `/admin/appointments`, order status/payment under
`/admin/orders/:id`, broadcast push `POST /admin/push`, settings `PATCH /admin/config`.

## Build order & gates

1. Skeleton + schema + deploy target → health check green
2. Auth → register/login/me, admin routes 403 for customers
3. Booking → 20 concurrent POSTs to same slot: exactly one 201, rest 409
4. Push → device registration, transactional pushes, reminder cron, broadcast
5. Shop → expired coupon rejected, totals correct, oversell rejected
6. Admin dashboard → owner changes price/cancels order/sends push unaided
7. Android → flows above against production API

## Explicitly deferred (until client #2 or real need)

RBAC/staff accounts, audit logs, analytics/funnels, segments, loyalty,
reviews/wishlists, product variants, multi-location, home-layout CMS,
refresh-token rotation, GraphQL, white-label flavors, super-admin panel,
abandoned-cart anything.
