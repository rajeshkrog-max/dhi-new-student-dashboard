// The day rule of the house (spec house/0004, AC-2, AC-3, AC-13). A day runs from 04:00 to 04:00 India time, for everyone: every institute is in
// India and India has no daylight saving, so the rule is one fixed offset. A meal at 01:00 counts for the day before.
// This file is pure. It imports nothing, reads no database and no clock: the caller passes the time. The server (events.ts and the rooms) and
// the house screens use this same file, exported from the package as `@dhi/backend/dayRules`, so the two can never disagree about a day.

// India time is UTC+05:30, and a day begins at 04:00, so a day key is the UTC date of (time + 1h30).
export const BOUNDARY_HOUR = 4;
// The log accepts an event for today and for up to this many days back (today is day 0). A room may allow fewer.
export const MAX_AGE_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

const INDIA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const SHIFT_MS = INDIA_OFFSET_MS - BOUNDARY_HOUR * 60 * 60 * 1000;

// "2026-10-19". Years 2000 to 2999 only, so a key always sorts as plain text and `Date.UTC` never treats a short year as 19xx.
const DAY_RE = /^(2\d{3})-(\d{2})-(\d{2})$/;

// True for a real calendar day written exactly `YYYY-MM-DD` (so "2027-02-29" is false and "2028-02-29" is true).
export function isDayKey(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const m = DAY_RE.exec(text);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(Number(m[1]), month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function keyOfUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// The day a moment counts for. 03:59:59.999 belongs to the earlier day and 04:00:00.000 to the next.
export function dayOf(ms: number): string {
  if (!Number.isFinite(ms)) throw new RangeError("dayOf needs a finite time");
  return keyOfUtc(ms + SHIFT_MS);
}

// The day it is now, for a clock the caller read. Same rule as `dayOf`.
export const todayOf = (now: number): string => dayOf(now);

function startOf(day: string): number {
  if (!isDayKey(day)) throw new RangeError("not a day key");
  const m = DAY_RE.exec(day) as RegExpExecArray;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - SHIFT_MS;
}

// The first moment of a day and the first moment of the next one: a day holds `start <= time < end`.
export function dayBounds(day: string): { start: number; end: number } {
  const start = startOf(day);
  return { start, end: start + DAY_MS };
}

// The day `n` days after (or before, when negative) a day. Works across month ends, year ends and 29 February.
export function shiftDay(day: string, n: number): string {
  if (!Number.isInteger(n)) throw new RangeError("shiftDay needs a whole number of days");
  const m = DAY_RE.exec(day);
  if (!m || !isDayKey(day)) throw new RangeError("not a day key");
  return keyOfUtc(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
}

// An event is late when it is written on a later day than the day it counts for.
export function isLate(loggedFor: string, nowMs: number): boolean {
  return todayOf(nowMs) > loggedFor;
}
