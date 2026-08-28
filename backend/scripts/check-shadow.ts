import { PrismaClient } from "@prisma/client";

const url = process.env.SHADOW_DATABASE_URL;
if (!url) {
  console.log("SHADOW FAIL: SHADOW_DATABASE_URL not set");
  process.exit(0);
}

const p = new PrismaClient({ datasources: { db: { url } } });
try {
  await p.$queryRawUnsafe("SELECT 1");
  console.log("SHADOW OK");
} catch (e) {
  console.log("SHADOW FAIL:", String(e instanceof Error ? e.message : e).slice(0, 200));
}
await p.$disconnect();
process.exit(0);
