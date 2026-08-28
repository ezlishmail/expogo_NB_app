import type { FastifyInstance } from "fastify";
import prisma from "../db";

// Public tenant configuration: branding, feature flags, business settings.
// Drives the mobile app's theme + bottom-nav tabs; contains nothing sensitive.
export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get("/config", async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: process.env.TENANT_SLUG },
    });
    if (!tenant) {
      return {
        tenantId: null,
        brand: {},
        features: {},
        settings: {},
      };
    }
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    return {
      tenantId: tenant.slug,
      name: tenant.name,
      brand: tenant.brand,
      features: tenant.features,
      settings: {
        currency: settings.currency ?? "INR",
        timezone: settings.timezone ?? "Asia/Kolkata",
        deliveryFeeCents: settings.deliveryFeeCents ?? 0,
        freeDeliveryOverCents: settings.freeDeliveryOverCents ?? null,
        openingHours: settings.openingHours ?? {},
        address: settings.address ?? null,
        phone: settings.phone ?? null,
        upiId: settings.upiId ?? null,
        // Payments v1: COD / pay-at-counter only; online gateway is a placeholder.
        codEnabled: settings.codEnabled ?? true,
        codChargeCents: settings.codChargeCents ?? 0,
        onlinePaymentEnabled: settings.onlinePaymentEnabled ?? false,
        reminderHours: settings.reminderHours ?? [24, 2],
        minCancelNoticeMin: settings.minCancelNoticeMin ?? 120,
        maxAdvanceDays: settings.maxAdvanceDays ?? 30,
      },
    };
  });
}
