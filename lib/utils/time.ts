// Single source of truth for UK time handling (Gokul, 2026-10-15: "all times
// are UK local time" — GMT in winter, BST in summer).
//
// Timestamps (visits.scheduled_start, incidents.created_at, …) are stored as
// UTC instants. Everything a person reads or types is UK wall-clock time, so:
//   - never format a timestamp without timeZone: UK_TZ (Netlify renders in UTC,
//     browsers render in whatever zone the device is set to);
//   - never slice an ISO string for a time or date (that's the UTC value);
//   - never build a timestamp with new Date(`${date}T${time}`) (that uses the
//     zone of whichever machine runs it) — use ukWallTimeToISO().
export const UK_TZ = "Europe/London";

function partsOf(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const out: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** Minutes the UK is ahead of UTC at a given instant (0 in GMT, 60 in BST). */
function ukOffsetMinutes(date: Date): number {
  const p = partsOf(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UK calendar date (YYYY-MM-DD) of an instant — defaults to now. */
export function ukDateISO(value: Date | string = new Date()): string {
  const p = partsOf(typeof value === "string" ? new Date(value) : value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UK wall-clock time (HH:MM) of an instant. */
export function ukTimeHHMM(value: Date | string): string {
  const p = partsOf(typeof value === "string" ? new Date(value) : value);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Converts a UK wall-clock date + time ("2026-10-16", "14:00") to a UTC ISO timestamp. */
export function ukWallTimeToISO(dateISO: string, hhmm: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let instant = guess - ukOffsetMinutes(new Date(guess)) * 60000;
  // Re-check once in case the guess and the answer straddle a clock change.
  instant = guess - ukOffsetMinutes(new Date(instant)) * 60000;
  return new Date(instant).toISOString();
}

/** UTC instants bounding a UK calendar day: [start, end). */
export function ukDayRange(dateISO: string): { start: string; end: string } {
  return { start: ukWallTimeToISO(dateISO, "00:00"), end: ukWallTimeToISO(addDaysISO(dateISO, 1), "00:00") };
}

/** Pure calendar arithmetic on YYYY-MM-DD strings (zone-independent). */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds minutes to an "HH:MM" wall-clock time (same day, no zone involved). */
export function addMinutesHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutes since UK midnight for an instant (for proportional timelines). */
export function ukMinutesSinceMidnight(value: string | Date): number {
  const p = partsOf(typeof value === "string" ? new Date(value) : value);
  return p.hour * 60 + p.minute;
}

/** Day of week (0 = Sunday) of a UK calendar date or instant. */
export function ukWeekday(value: string | Date): number {
  const iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ukDateISO(value);
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Current hour (0–23) on a UK clock. */
export function ukHour(now: Date = new Date()): number {
  return partsOf(now).hour;
}

type FmtOpts = Omit<Intl.DateTimeFormatOptions, "timeZone">;

/** Formats a timestamp as UK time (default "09:00"). */
export function formatUKTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: UK_TZ });
}

/** Formats a timestamp's UK date. Date-only strings (YYYY-MM-DD) are treated as that calendar day. */
export function formatUKDate(value: string | Date, opts: FmtOpts = { day: "numeric", month: "short", year: "numeric" }): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return date.toLocaleDateString("en-GB", { ...opts, timeZone: UK_TZ });
}

/** Formats a timestamp as UK date + time. */
export function formatUKDateTime(value: string | Date, opts: FmtOpts = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }): string {
  return new Date(value).toLocaleString("en-GB", { ...opts, timeZone: UK_TZ });
}

/** £ amount with 2 decimal places and thousands separators. */
export function formatGBP(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
