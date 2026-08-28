import type { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../db";
import { badRequest, conflict, isUniqueViolation, isOverlapViolation, notFound } from "../lib/errors";
import { computeSlots, findFreeStaff, parseTenantSettings } from "../lib/booking";
import { notifyUser } from "../lib/notify";

const bookSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
});

export async function appointmentRoutes(app: FastifyInstance): Promise<void> {
  const authed = { preHandler: [app.authenticate] };

  async function getTenant() {
    const tenant = await prisma.tenant.findUnique({ where: { slug: process.env.TENANT_SLUG } });
    if (!tenant) throw badRequest("TENANT_NOT_FOUND", "Tenant not configured");
    return tenant;
  }

  app.get("/availability", authed, async (request) => {
    const q = z
      .object({
        serviceId: z.string().uuid(),
        staffId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(request.query);

    const tenant = await getTenant();
    const service = await prisma.service.findFirst({
      where: { id: q.serviceId, tenantId: tenant.id, active: true },
    });
    if (!service) throw notFound("Service not found");

    const slots = await computeSlots({
      settings: tenant.settings,
      service,
      dateStr: q.date,
      staffId: q.staffId ?? null,
    });
    return { slots };
  });

  // Transactional booking. The Postgres exclusion constraint on
  // (staffId, startsAt..endsAt) makes concurrent double-bookings impossible;
  // losers surface here as 409 APPOINTMENT_SLOT_UNAVAILABLE.
  app.post("/appointments", { ...authed, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = bookSchema.parse(request.body);
    const tenant = await getTenant();
    const cfg = parseTenantSettings(tenant.settings);

    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, tenantId: tenant.id, active: true },
    });
    if (!service) throw notFound("Service not found");

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
    if (startsAt.getTime() < Date.now()) {
      throw badRequest("SLOT_IN_PAST", "That time has already passed");
    }
    if (startsAt.getTime() > Date.now() + cfg.maxAdvanceDays * 24 * 3600_000) {
      throw badRequest("TOO_FAR_AHEAD", `Bookings open ${cfg.maxAdvanceDays} days in advance`);
    }

    const staff = await findFreeStaff({
      settings: tenant.settings,
      service,
      startsAt,
      endsAt,
      staffId: input.staffId ?? null,
    });
    if (!staff) {
      throw conflict("APPOINTMENT_SLOT_UNAVAILABLE", "This slot is no longer available");
    }

    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          customerId: request.user.sub,
          staffId: staff.id,
          serviceId: service.id,
          startsAt,
          endsAt,
          status: "CONFIRMED",
        },
      });
    } catch (err) {
      if (isUniqueViolation(err) || isOverlapViolation(err)) {
        throw conflict("APPOINTMENT_SLOT_UNAVAILABLE", "This slot is no longer available");
      }
      throw err;
    }

    void notifyUser(request.user.sub, "APPOINTMENT_CONFIRMED", {
      title: "Appointment confirmed",
      body: `${service.name} on ${startsAt.toISOString()}`,
      deeplink: `/appointment/${appointment.id}`,
    });

    return reply.code(201).send({ appointment: serialize(appointment, service.name, staff.name) });
  });

  app.get("/appointments", authed, async (request) => {
    const q = z
      .object({ upcoming: z.enum(["true", "false"]).optional() })
      .parse(request.query);
    const now = new Date();
    const rows = await prisma.appointment.findMany({
      where: {
        customerId: request.user.sub,
        ...(q.upcoming === "true"
          ? { startsAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] } }
          : {}),
      },
      include: {
        service: { select: { name: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startsAt: q.upcoming === "true" ? "asc" : "desc" },
      take: 100,
    });
    return {
      appointments: rows.map((a) =>
        serialize(a, a.service.name, a.staff.name),
      ),
    };
  });

  app.patch("/appointments/:id/cancel", authed, async (request, reply) => {
    const { id } = request.params as { id: string };
    const appt = await prisma.appointment.findFirst({
      where: { id, customerId: request.user.sub },
      include: { service: { select: { name: true, durationMin: true } } },
    });
    if (!appt) throw notFound("Appointment not found");
    if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
      throw badRequest("NOT_CANCELLABLE", `Appointment is already ${appt.status.toLowerCase()}`);
    }
    const cfg = parseTenantSettings((await getTenant()).settings);
    if (appt.startsAt.getTime() - Date.now() < cfg.minCancelNoticeMin * 60_000) {
      throw badRequest(
        "CANCEL_TOO_LATE",
        `Cancellations need ${cfg.minCancelNoticeMin} minutes notice — call us instead`,
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "CANCELLED" },
    });
    void notifyUser(request.user.sub, "APPOINTMENT_CANCELLED", {
      title: "Appointment cancelled",
      body: `${appt.service.name}`,
      deeplink: `/appointment/${updated.id}`,
    });
    return reply.send({ appointment: serialize(updated, appt.service.name) });
  });

  // Reschedule keeps status CONFIRMED by design (no RESCHEDULED state).
  app.patch("/appointments/:id", authed, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = bookSchema
      .extend({ staffId: z.string().uuid().optional() })
      .partial({ serviceId: true })
      .parse(request.body);

    const appt = await prisma.appointment.findFirst({
      where: { id, customerId: request.user.sub },
      include: { service: true },
    });
    if (!appt || appt.tenantId !== request.user.tid) throw notFound("Appointment not found");
    if (appt.status !== "CONFIRMED" && appt.status !== "PENDING") {
      throw badRequest("NOT_RESCHEDULABLE", `Appointment is ${appt.status.toLowerCase()}`);
    }

    const tenant = await getTenant();
    const cfg = parseTenantSettings(tenant.settings);
    const startsAt = input.startsAt ? new Date(input.startsAt) : appt.startsAt;
    const durationMin =
      input.serviceId && input.serviceId !== appt.serviceId
        ? (await prisma.service.findUnique({ where: { id: input.serviceId } }))?.durationMin ??
          appt.service.durationMin
        : appt.service.durationMin;
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

    if (startsAt.getTime() < Date.now()) {
      throw badRequest("SLOT_IN_PAST", "That time has already passed");
    }
    if (startsAt.getTime() > Date.now() + cfg.maxAdvanceDays * 24 * 3600_000) {
      throw badRequest("TOO_FAR_AHEAD", `Bookings open ${cfg.maxAdvanceDays} days in advance`);
    }

    const staff = await findFreeStaff({
      settings: tenant.settings,
      service: { ...appt.service, durationMin },
      startsAt,
      endsAt,
      staffId: input.staffId ?? null,
      excludeAppointmentId: appt.id,
    });
    if (!staff) throw conflict("APPOINTMENT_SLOT_UNAVAILABLE", "This slot is no longer available");

    let updated;
    try {
      updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          startsAt,
          endsAt,
          staffId: staff.id,
          ...(input.serviceId ? { serviceId: input.serviceId } : {}),
        },
      });
    } catch (err) {
      if (isUniqueViolation(err) || isOverlapViolation(err)) {
        throw conflict("APPOINTMENT_SLOT_UNAVAILABLE", "This slot is no longer available");
      }
      throw err;
    }

    void notifyUser(request.user.sub, "APPOINTMENT_RESCHEDULED", {
      title: "Appointment rescheduled",
      body: `${appt.service.name} moved to ${startsAt.toISOString()}`,
      deeplink: `/appointment/${updated.id}`,
    });
    return reply.send({ appointment: serialize(updated, appt.service.name, staff.name) });
  });

  function serialize(
    a: { id: string; startsAt: Date; endsAt: Date; status: string; notes: string | null },
    serviceName: string,
    staffName?: string,
  ) {
    return {
      id: a.id,
      serviceName,
      staffName: staffName ?? null,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status,
      notes: a.notes,
    };
  }
}
