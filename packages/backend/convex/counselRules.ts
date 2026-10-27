// The pure rules of counseling (spec house/0024). No imports, so the screens read the same numbers (`@dhi/backend/counselRules`).
export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;
export const MAX_DAYS_AHEAD = 60; // a counselor opens slots at most this far ahead
export const STUDENT_DAYS_SHOWN = 14; // the free slots a student sees, from now
export const NOTE_MAX = 300; // the student's own optional note, in letters
export const SUMMARY_MAX = 1000; // the counselor's short summary after a session
export const OPEN_SLOTS_MAX = 200; // open slots one counselor may hold at a time
export const SHARES_MAX = 10; // people one session's recording may be shared with

// The session is a Stream Video call inside the house (owner, 2026-10-27): a private call type where only the call's two members can join, and
// every call is recorded and transcribed. The call id is the booking's id. A call opens JOIN_EARLY_MS before the slot and closes JOIN_LATE_MS after.
export const CALL_TYPE = "dhi_counsel";
export const JOIN_EARLY_MS = 10 * 60 * 1000;
export const JOIN_LATE_MS = 30 * 60 * 1000;
export const CALL_MAX_SECONDS = 60 * 60;
export const callOpenAt = (startsAt: number, endsAt: number, now: number): boolean => now >= startsAt - JOIN_EARLY_MS && now <= endsAt + JOIN_LATE_MS;

const DAY_MS = 24 * 60 * 60 * 1000;

// A slot's start must be on the half hour, in the future, and within MAX_DAYS_AHEAD. Returns the problem code or null.
export function slotProblem(startsAt: number, now: number): "bad_time" | "too_soon" | "too_far" | null {
  if (!Number.isFinite(startsAt) || startsAt % SLOT_MS !== 0) return "bad_time";
  if (startsAt <= now) return "too_soon";
  if (startsAt > now + MAX_DAYS_AHEAD * DAY_MS) return "too_far";
  return null;
}

// Free text of at most `max` letters (code points), trimmed. Null when it is too long.
export function cleanText(raw: string, max: number): string | null {
  const text = raw.trim();
  return [...text].length <= max ? text : null;
}

// The first word of a name: what a counselor sees of the student who booked, and a student of the counselor.
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";
