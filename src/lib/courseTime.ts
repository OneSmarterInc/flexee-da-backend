// src/lib/courseTime.ts
//
// Course time: every course runs in its own IANA time zone, chosen when it
// is created. Deadlines are computed on that zone's calendar (so daylight
// saving is handled) and shown with the zone's abbreviation. Uses only the
// Intl API built into Node; no date library.

/** Every quarter closes at this local time on its last day. */
export const QUARTER_CLOSE_LOCAL = { hour: 23, minute: 59 } as const;

/** True if `tz` is an IANA time zone this runtime knows. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The wall-clock reading of `date` in `tz`. */
export function partsInZone(date: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** How far `tz` is ahead of UTC at `date`, in ms. */
function offsetMs(date: Date, tz: string): number {
  const p = partsInZone(date, tz);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which the clock in `tz` reads the given local time. In the
 * spring-forward gap the result is the first valid minute after it; in the
 * fall-back overlap it is the first of the two readings.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const a = guess - offsetMs(new Date(guess), tz);
  const b = guess - offsetMs(new Date(a), tz);
  const reads = (t: number) => {
    const p = partsInZone(new Date(t), tz);
    return p.day === day && p.hour === hour && p.minute === minute;
  };
  const okA = reads(a);
  const okB = reads(b);
  if (okA && okB) return new Date(Math.min(a, b)); // overlap: first reading
  if (okA) return new Date(a);
  if (okB) return new Date(b);
  return new Date(Math.max(a, b)); // gap: first valid minute after it
}

/**
 * `date` moved by `days` on the calendar of `tz`, keeping its local time of
 * day. One day is a calendar day, not 24 hours, so a deadline doesn't drift
 * an hour across a daylight-saving change.
 */
export function addLocalDays(date: Date, days: number, tz: string): Date {
  const p = partsInZone(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedTimeToUtc(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    p.hour,
    p.minute,
    tz,
  );
}

/**
 * A quarter that opens at `start` and lasts `days` days closes at
 * QUARTER_CLOSE_LOCAL on the course calendar, `days` days after the day it
 * opened.
 */
export function quarterDeadline(start: Date, days: number, tz: string): Date {
  const p = partsInZone(start, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedTimeToUtc(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    QUARTER_CLOSE_LOCAL.hour,
    QUARTER_CLOSE_LOCAL.minute,
    tz,
  );
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "21 Oct 2026" on the course calendar. */
export function formatCourseDate(date: Date, tz: string): string {
  const p = partsInZone(date, tz);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** The zone's abbreviation at `date`, e.g. "EDT", or "GMT+5:30" if none. */
export function zoneAbbreviation(date: Date, tz: string): string {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? tz;
}

/** "21 Oct 2026, 11:59 PM EDT" on the course calendar. */
export function formatCourseDateTime(date: Date, tz: string): string {
  const p = partsInZone(date, tz);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? 'AM' : 'PM';
  const mm = String(p.minute).padStart(2, '0');
  return `${formatCourseDate(date, tz)}, ${h12}:${mm} ${ampm} ${zoneAbbreviation(date, tz)}`;
}
