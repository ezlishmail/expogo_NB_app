# nb-backend

Fastify + Prisma + Postgres (Neon) API. See `../docs/architecture.md` for the
design.

## Setup

1. Create a free project at [neon.tech](https://neon.tech) (name it `nb-app`).
2. Copy the **direct** (non-pooled) connection string from the dashboard.
3. In the Neon SQL Console run `CREATE DATABASE shadow;` and build a second
   connection string with `/shadow` in place of the db name (also direct).
4. `copy .env.example .env` and paste both strings.
5. First-time schema creation:
   ```powershell
   npx prisma migrate dev --create-only --name init
   # open prisma/migrations/*_init/migration.sql and append
   # the contents of prisma/exclusion-constraint.sql
   npx prisma migrate dev
   npm run db:seed
   ```
6. `npm run dev` then check http://localhost:3000/api/v1/health → `"db":"up"`

## Notes

- Runs via tsx in all environments; no separate build step at this size.
- The exclusion constraint is raw SQL on purpose — Prisma can't express it, and
  it's what makes booking concurrency-safe.
- Deactivate coupons/products instead of deleting them; redemption/order rows
  reference them by design.
