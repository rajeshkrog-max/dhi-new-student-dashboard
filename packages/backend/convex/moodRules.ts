// The pure rules of the mood room (spec house/0006): the ten mood codes, the three gunas and the fixed map from a mood to a guna, and the note
// limits. No database and no clock. Exported from the package as `@dhi/backend/moodRules`, so the screen and the server read the same lists.

export const MOOD_CODES = ["best", "happy", "motivated", "determined", "content", "tired", "stressed", "anxious", "sad", "heavy"] as const;
export type MoodCode = (typeof MOOD_CODES)[number];
export const isMood = (text: unknown): text is MoodCode => typeof text === "string" && (MOOD_CODES as readonly string[]).includes(text);

export const GUNAS = ["sattva", "rajas", "tamas"] as const;
export type Guna = (typeof GUNAS)[number];

// The Vedic lens (AC-8): one fixed map. A mood leans toward a guna; it is never a score and never a label on the student.
export const GUNA_OF: Readonly<Record<MoodCode, Guna>> = {
  best: "sattva",
  happy: "sattva",
  content: "sattva",
  motivated: "rajas",
  determined: "rajas",
  stressed: "rajas",
  anxious: "rajas",
  tired: "tamas",
  sad: "tamas",
  heavy: "tamas",
};

// The note: trimmed first, then measured in code points (an emoji counts once), at most 500. Newlines are allowed.
export const MAX_NOTE = 500;
export const noteLength = (note: string): number => [...note].length;

// A student may change the mood of one day at most this many times (the first save is not a change), so edits cannot use up the log's 500
// events a day or hide the day from a class total.
export const MAX_MOOD_CHANGES = 10;

export const MONTH_RE = /^2\d{3}-(0[1-9]|1[0-2])$/;
export const YEAR_RE = /^2\d{3}$/;

// Which of the two DHI lines a day gets, set once when the day is first saved.
export const lineIxOf = (day: string): number => Number(day.slice(8)) % 2;
