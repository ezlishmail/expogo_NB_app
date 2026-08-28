import type { Prisma, Service, Staff, AppointmentStatus } from "@prisma/client";
import prisma from "../db";
import { badRequest } from "./errors";
import { minutesOfDayIn, wallTimeToUtc, weekdayOf } from "./tz";

export interface Slot {
  startsAt: string;
  endsAt: string;
  staffId: string;
}

interface Interval {
  startMs: number;
  endMs: number;
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

function overlaps(a: Interval, b: Interval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function parseTenantSettings(settings: Prisma.JsonValue): {
  timezone: string;
  reminderHours: number[];
  minCancelNoticeMin: number;
  maxAdvanceDays: number;
} {
  const s = (settings ?? {}) as Record<string, unknown>;
  return {
    timezone: typeof s.timezone === "string" ? s.timezone : "Asia/Kolkata",
    reminderHours: Array.isArray(s.reminderHours)
      ? (s.reminderHours as unknown[]).filter((n): n is number => typeof n === "number")
      : [24, 2],
    minCancelNoticeMin: typeof s.minCancelNoticeMin === "number" ? s.minCancelNoticeMin : 120,
    maxAdvanceDays: typeof s.maxAdvanceDays === "number" ? s.maxAdvanceDays : 30,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// All bookable slots for a service on a tenant-local date across eligible
// staff (or one specific staff member when staffId is given).
export async function computeSlots(opts: {
  settings: Prisma.JsonValue;
  service: Service;
  dateStr: string;
  staffId?: string | null;
}): Promise<Slot[]> {
  if (!DATE_RE.test(opts.dateStr)) throw badRequest("INVALID_DATE", "date must be YYYY-MM-DD");
  const cfg = parseTenantSettings(opts.settings);
  const weekday = weekdayOf(opts.dateStr);
  const now = Date.now();

  const staffMembers = await prisma.staff.findMany({
    where: {
      active: true,
      ...(opts.staffId ? { id: opts.staffId } : {}),
      staffServices: { some: { serviceId: opts.service.id } },
    },
    include: {
      availability: true,
      timeOff: {
        where: {
          startsAt: { lt: endOfDayUtc(opts.dateStr, cfg.timezone) },
          endsAt: { gt: startOfDayUtc(opts.dateStr, cfg.timezone) },
        },
      },
      appointments: {
        where: {
          status: { in: ACTIVE_STATUSES },
          startsAt: { lt: endOfDayUtc(opts.dateStr, cfg.timezone) },
          endsAt: { gt: startOfDayUtc(opts.dateStr, cfg.timezone) },
        },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  const slots: Slot[] = [];
  const stepMin = Math.max(opts.service.durationMin, 5);

  for (const staff of staffMembers) {
    const busy: Interval[] = [
      ...staff.timeOff.map((t) => ({ startMs: t.startsAt.getTime(), endMs: t.endsAt.getTime() })),
      ...staff.appointments.map((a) => ({ startMs: a.startsAt.getTime(), endMs: a.endsAt.getTime() })),
    ];
    const windows = staff.availability.filter((a: StaffAvailabilityRow) => a.weekday === weekday);

    for (const w of windows) {
      for (let t = w.startMin; t + opts.service.durationMin <= w.endMin; t += stepMin) {
        const start = wallTimeToUtc(opts.dateStr, t, cfg.timezone);
        const end = new Date(start.getTime() + opts.service.durationMin * 60_000);
        if (start.getTime() < now) continue;
        const candidate: Interval = { startMs: start.getTime(), endMs: end.getTime() };
        if (busy.some((b) => overlaps(candidate, b))) continue;
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), staffId: staff.id });
      }
    }
  }

  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.staffId.localeCompare(b.staffId));
  return slots;
}

type StaffAvailabilityRow = { weekday: number; startMin: number; endMin: number };

function startOfDayUtc(dateStr: string, tz: string): Date {
  return wallTimeToUtc(dateStr, 0, tz);
}
function endOfDayUtc(dateStr: string, tz: string): Date {
  return wallTimeToUtc(dateStr, 24 * 60, tz);
}

// Returns a free staff member for the exact interval, or null. Availability
// windows are checked against tenant-local wall-clock times.
export async function findFreeStaff(opts: {
  settings: Prisma.JsonValue;
  service: Service;
  startsAt: Date;
  endsAt: Date;
  staffId?: string | null;
  excludeAppointmentId?: string;
}): Promise<Staff | null> {
  const cfg = parseTenantSettings(opts.settings);
  const dateStr = localDateStr(opts.startsAt, cfg.timezone);
  const weekday = weekdayOf(dateStr);

  const candidates = await prisma.staff.findMany({
    where: {
      active: true,
      ...(opts.staffId ? { id: opts.staffId } : {}),
      staffServices: { some: { serviceId: opts.service.id } },
    },
    include: {
      availability: true,
      timeOff: {
        where: { startsAt: { lt: opts.endsAt }, endsAt: { gt: opts.startsAt } },
      },
      appointments: {
        where: {
          status: { in: ACTIVE_STATUSES },
          ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
          startsAt: { lt: opts.endsAt },
          endsAt: { gt: opts.startsAt },
        },
        select: { id: true },
      },
    },
  });

  const wanted: Interval = { startMs: opts.startsAt.getTime(), endMs: opts.endsAt.getTime() };

  for (const staff of candidates) {
    if (staff.timeOff.some((t) => overlaps({ startMs: t.startsAt.getTime(), endMs: t.endsAt.getTime() }, wanted))) continue;
    if (staff.appointments.length > 0) continue;

    const startMin = minutesOfDayIn(opts.startsAt, cfg.timezone);
    const endMin = minutesOfDayIn(opts.endsAt, cfg.timezone);
    const fits = staff.availability.some(
      (a: StaffAvailabilityRow) => a.weekday === weekday && a.startMin <= startMin && endMin <= a.endMin,
    );
    if (fits) return staff;
  }
  return null;
}

function localDateStr(instant: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(instant);
}
