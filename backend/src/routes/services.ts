import type { FastifyInstance } from "fastify";
import prisma from "../db";
import { getTenantId } from "../lib/tenant";

export async function serviceRoutes(app: FastifyInstance): Promise<void> {
  // Bookable services, cheapest/first-ordered.
  app.get("/services", async () => {
    const tenantId = await getTenantId();
    const services = await prisma.service.findMany({
      where: { tenantId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, durationMin: true, priceCents: true, category: true, forGender: true },
    });
    return { services };
  });

  // Staff who can perform each service (for "select staff" step).
  app.get("/staff", async () => {
    const tenantId = await getTenantId();
    const staff = await prisma.staff.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
      include: {
        staffServices: { select: { serviceId: true } },
      },
    });
    return {
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        bio: s.bio,
        gender: s.gender,
        photoUrl: s.photoUrl,
        specialties: s.specialties,
        serviceIds: s.staffServices.map((ss) => ss.serviceId),
      })),
    };
  });
}
