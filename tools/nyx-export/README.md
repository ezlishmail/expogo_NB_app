# NYX SYS export

One-time migration scripts: read NYX SYS's SQLite file, map services / staff /
products / categories / (optional historical appointments) into seed data for
the backend.

To be written once pointed at the real NYX SYS `.sqlite` file. Planned shape:

- `export.ts` — opens the SQLite DB read-only, dumps normalized JSON to stdout
  or `nyx-export.json`
- `import.ts` — upserts that JSON into Postgres under the northern-bloom tenant

Run on any machine that has a copy of the SQLite file; nothing here touches
production data directly except through the normal Prisma client.
