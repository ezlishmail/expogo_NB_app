import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const tenants = await p.tenant.count();
const constraint = await p.$queryRawUnsafe<{ conname: string }[]>(
  `select conname from pg_constraint where conname = 'appointments_no_double_booking'`,
);

console.log("tenants:", tenants);
console.log("no_double_booking constraint:", constraint.length > 0 ? "PRESENT" : "MISSING");

await p.$disconnect();
