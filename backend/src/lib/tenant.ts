import prisma from "../db";
import { env } from "../config";
import { badRequest } from "./errors";

// Resolve the single tenant this deployment serves (via TENANT_SLUG).
// Public read routes (services/staff/catalog/products) MUST scope their
// queries by this tenantId so they never leak across tenants when more than
// one tenant row shares a database — which is exactly what the MANUAL §4
// onboarding path does. Kept as a tiny shared helper so every public route
// scopes identically to /config and the admin routes.
export async function getTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: env.TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) throw badRequest("TENANT_NOT_FOUND", "Tenant not configured");
  return tenant.id;
}
