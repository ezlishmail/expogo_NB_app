-- Applied inside the init migration (prisma migrate dev --create-only --name init,
-- then paste this at the end of the generated migration.sql before running it).
-- Prevents overlapping active appointments per staff member, concurrency-safe.

create extension if not exists btree_gist;

alter table "appointments" add constraint "appointments_no_double_booking"
  exclude using gist (
    "staffId" with =,
    tsrange("startsAt", "endsAt") with &&
  )
  where ("status" in ('PENDING', 'CONFIRMED'));
