// Timezone-aware helpers for turning tenant-local wall-clock times into UTC
// Date objects. No external deps: uses Intl to resolve each date's offset,
// which correctly handles DST transitions.

interface OffsetParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(date: Date, timeZone: string): OffsetParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour === 24 ? 0 : parts.hour!,
    minute: parts.minute!,
  };
}

function asUTC(p: OffsetParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}

// Offset (ms) of timeZone at the given instant.
function tzOffsetMs(instant: number, timeZone: string): number {
  return asUTC(zonedParts(new Date(instant), timeZone)) - instant;
}

// "YYYY-MM-DD" + minutes-from-midnight in the tenant timezone -> UTC Date.
export function wallTimeToUtc(dateStr: string, minutesFromMidnight: number, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const naive = Date.UTC(y!, m! - 1, d!, Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60);
  // Two-pass resolution handles DST boundaries well enough for scheduling.
  let guess = naive - tzOffsetMs(naive, timeZone);
  guess = naive - tzOffsetMs(guess, timeZone);
  return new Date(guess);
}

// Weekday (0=Sunday..6=Saturday) of a calendar date. A "YYYY-MM-DD" day has
// the same weekday in every timezone, so pure UTC math is correct here.
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

// Start of the local day for a "YYYY-MM-DD" string, as a UTC instant.
export function startOfDayUtc(dateStr: string, timeZone: string): Date {
  return wallTimeToUtc(dateStr, 0, timeZone);
}

// Today's local date string ("YYYY-MM-DD") in the tenant timezone.
export function todayIn(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

// Minutes-from-midnight of an instant, tenant-local.
export function minutesOfDayIn(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}
