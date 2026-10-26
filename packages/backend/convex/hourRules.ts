// The pure rules of the study hour (spec house/0015). No database and no clock, and no imports. A DHI admin opens and closes the hour. A student
// enters a seat only while it is open, as Live, Away or Do not disturb. Every seat sends a heartbeat; a seat with no heartbeat for 60 seconds is
// dropped, so a closed tab never inflates the minutes. Each institute sees only its own students in the hour. Do not disturb hides the student
// from others, and shows them no one and no chat.

export const MODES = ["live", "away", "dnd"] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (text: unknown): text is Mode => typeof text === "string" && (MODES as readonly string[]).includes(text);

export const MIN_HOUR_MS = 5 * 60 * 1000;
export const MAX_HOUR_MS = 8 * 60 * 60 * 1000;
// A seat is dropped when no heartbeat arrived for this long. The screen sends one every 20 seconds.
export const STALE_MS = 60 * 1000;
export const BEAT_MS = 20 * 1000;
export const MAX_MESSAGE = 300;
export const MESSAGES_SHOWN = 50;
// Presence is written as whole minutes, and only from one minute up. A stay is never longer than the longest hour.
export const MAX_PRESENT_MINUTES = 480;

// The window of an hour: the open time comes before the close time, at least five minutes apart and at most eight hours.
export function windowProblem(opensAt: number, closesAt: number): "bad_window" | null {
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) return "bad_window";
  const span = closesAt - opensAt;
  return span >= MIN_HOUR_MS && span <= MAX_HOUR_MS ? null : "bad_window";
}

// Two hours overlap when each starts before the other ends. An hour that ends exactly when another starts does not overlap it.
export const overlaps = (a: { opensAt: number; closesAt: number }, b: { opensAt: number; closesAt: number }): boolean => a.opensAt < b.closesAt && b.opensAt < a.closesAt;

export const isOpenAt = (now: number, hour: { opensAt: number; closesAt: number }): boolean => now >= hour.opensAt && now < hour.closesAt;

// A seat is current while it has not left, the hour is still open, and its last heartbeat is recent.
export function seatIsCurrent(seat: { leftAt?: number | undefined; lastBeatAt: number }, hour: { opensAt: number; closesAt: number }, now: number): boolean {
  return seat.leftAt === undefined && isOpenAt(now, hour) && now - seat.lastBeatAt < STALE_MS;
}

// What one student may see of another's seat. A viewer in Do not disturb sees no one. A seat in Do not disturb is seen by no one else. A seat in
// Away shows the profile only, and a seat in Live shows the student.
export function canSee(viewerMode: Mode, seatMode: Mode): boolean {
  if (viewerMode === "dnd") return false;
  return seatMode !== "dnd";
}

// Whole minutes between two times, from one minute up to the longest hour; 0 for a stay under a minute.
export function minutesPresent(enteredAt: number, leftAt: number): number {
  const minutes = Math.floor((leftAt - enteredAt) / 60000);
  return Math.max(0, Math.min(MAX_PRESENT_MINUTES, minutes));
}

// The minutes of a stay that fall after 23:00 on the house day (the Master Spec's late night study time, H11): from 23:00 to the 04:00 that ends the day.
const IST_MS = 5.5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export function lateMinutes(enteredAt: number, leftAt: number): number {
  if (!(leftAt > enteredAt)) return 0;
  const windowStart = (t: number) => Math.floor((t + IST_MS - 4 * HOUR_MS) / (24 * HOUR_MS)) * 24 * HOUR_MS + 4 * HOUR_MS - IST_MS + 19 * HOUR_MS;
  let total = 0;
  const first = windowStart(enteredAt);
  for (const from of first === windowStart(leftAt) ? [first] : [first, windowStart(leftAt)]) {
    const overlap = Math.min(leftAt, from + 5 * HOUR_MS) - Math.max(enteredAt, from);
    if (overlap > 0) total += overlap;
  }
  return Math.min(MAX_PRESENT_MINUTES, Math.floor(total / 60000));
}

// The time a dropped seat counts until: the end of the hour, or the last heartbeat, whichever came first (a stay never runs past the hour).
export const leftTimeOf = (seat: { lastBeatAt: number }, hour: { closesAt: number }, now: number, leaving: boolean): number =>
  leaving ? Math.min(now, hour.closesAt) : Math.min(seat.lastBeatAt, hour.closesAt);

// A message: trimmed, not empty, within the length (counted in code points). Returns the cleaned text or null.
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text.length > 0 && [...text].length <= MAX_MESSAGE ? text : null;
}
