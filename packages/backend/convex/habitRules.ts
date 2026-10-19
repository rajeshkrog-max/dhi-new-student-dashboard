// The pure rules of the habits room (spec house/0007): the window and title checks. No database and no clock: the caller passes today. The fixed
// lists and limits are in habitCodes.ts (re-exported here).
import { isDayKey, shiftDay } from "./dayRules";
import { MAX_TITLE, MAX_WINDOW_DAYS, START_AHEAD_DAYS } from "./habitCodes";

export * from "./habitCodes";

// One line, trimmed, 1 to 40 characters counted in code points, no control characters. Returns the cleaned title or null.
export function cleanHabitTitle(raw: string): string | null {
  const title = raw.trim();
  if (title.length === 0 || [...title].length > MAX_TITLE) return null;
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(title)) return null;
  return title;
}

// The window rule (AC-2): both ends are real days, the start is today to +14, the end is on or after the start and no later than start + 89.
export function windowProblem(today: string, startOn: string, endOn: string): "bad_window" | null {
  if (!isDayKey(startOn) || !isDayKey(endOn) || !isDayKey(today)) return "bad_window";
  if (startOn < today || startOn > shiftDay(today, START_AHEAD_DAYS)) return "bad_window";
  if (endOn < startOn || endOn > shiftDay(startOn, MAX_WINDOW_DAYS - 1)) return "bad_window";
  return null;
}
