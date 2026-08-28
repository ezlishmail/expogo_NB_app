import prisma from "../db";
import { parseTenantSettings } from "./booking";
import { notifyUser } from "./notify";

// Scans upcoming confirmed appointments and sends each configured reminder
// (e.g. 24h and 2h before) exactly once. Deduplication key:
// Notification(userId, type=REMINDER_<lead>H, deeplink=/appointment/<id>).
export async function runReminderScan(): Promise<number> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: process.env.TENANT_SLUG } });
  if (!tenant) return 0;

  const cfg = parseTenantSettings(tenant.settings);
  if (cfg.reminderHours.length === 0) return 0;
  const maxLeadMs = Math.max(...cfg.reminderHours) * 3600_000;
  const now = Date.now();

  const upcoming = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      status: "CONFIRMED",
      startsAt: { gt: new Date(now), lt: new Date(now + maxLeadMs + 60_000) },
    },
    include: {
      service: { select: { name: true } },
      staff: { select: { name: true } },
      customer: { select: { id: true } },
    },
  });

  let sent = 0;
  for (const appt of upcoming) {
    for (const leadHours of cfg.reminderHours) {
      const dueAt = appt.startsAt.getTime() - leadHours * 3600_000;
      if (now < dueAt) continue;

      const type = `REMINDER_${leadHours}H`;
      const deeplink = `/appointment/${appt.id}`;
      const already = await prisma.notification.findFirst({
        where: { userId: appt.customerId, type, deeplink },
        select: { id: true },
      });
      if (already) continue;

      const localTime = new Intl.DateTimeFormat("en-CA", {
        timeZone: cfg.timezone,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(appt.startsAt);

      await notifyUser(appt.customerId, type, {
        title: `Upcoming: ${appt.service.name}`,
        body: `${localTime} with ${appt.staff.name}`,
        deeplink,
      });
      sent += 1;
    }
  }
  return sent;
}

// Starts the in-process scheduler. Fine for a single-instance deployment;
// move to a queue/worker when the API scales horizontally.
export function startReminderCron(intervalMin = 5): void {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    runReminderScan()
      .then((n) => {
        if (n > 0) console.log(`[reminders] sent ${n}`);
      })
      .catch((err) => console.warn("[reminders] scan failed:", err))
      .finally(() => {
        running = false;
      });
  }, intervalMin * 60_000).unref();
}
