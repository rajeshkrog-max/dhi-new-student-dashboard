// The pure rules of the after session feeling card (spec house/0018, scope row 16; Master Spec calculation rule 7). No database and no clock, and no
// imports. When a study hour stay of 20 minutes or more ends (or a desk sitting of 10 minutes or more, when the desk opens), the student may tap how
// they felt (energised, okay, drained) and rate their focus from 1 to 5. The card can be skipped, and a skip is stored as skipped and changes no value.

export const FEELS = ["energised", "okay", "drained"] as const;
export type Feel = (typeof FEELS)[number];
export const isFeel = (text: unknown): text is Feel => typeof text === "string" && (FEELS as readonly string[]).includes(text);

export const FOCUS_MIN = 1;
export const FOCUS_MAX = 5;
export const isFocus = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= FOCUS_MIN && (value as number) <= FOCUS_MAX;

// The shortest stay that asks: 20 minutes in the study hour, 10 minutes at the desk.
export const HOUR_MIN_MINUTES = 20;
export const DESK_MIN_MINUTES = 10;
// A desk sitting (spec house/0018, desk part) is a run of questions with no gap over 15 minutes. It ends after 15 idle minutes, and its length is from
// the first question to the last one. At 10 minutes or more one card is offered; a shorter sitting asks nothing.
export const DESK_GAP_MS = 15 * 60 * 1000;
// The subjects a student may tag a desk or study hour card with, and a teacher picks for each paper question (house spec 0028). Optional on a card.
export const SUBJECTS = ["maths", "science", "english", "social", "hindi", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];
export const isSubject = (text: unknown): text is Subject => typeof text === "string" && (SUBJECTS as readonly string[]).includes(text);
// A paper question's subject as a code: the code itself, or the usual name of one in any case ("Maths", "Social studies"). Anything else is null.
const SUBJECT_ALIASES: Readonly<Record<string, Subject>> = {
  math: "maths",
  mathematics: "maths",
  "social studies": "social",
  "social science": "social",
  sst: "social",
};
export function subjectCodeOf(text: unknown): Subject | null {
  if (typeof text !== "string") return null;
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (isSubject(t)) return t;
  return SUBJECT_ALIASES[t] ?? null;
}
// The key a topic is found by: the teacher's words in lower case, with single spaces.
export const topicKeyOf = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, " ");
// A card that was not answered or skipped is offered for 24 hours, then it is left alone (it counts as nothing, like a skip).
export const OFFER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const TIME_BANDS = ["before_18", "evening", "night"] as const;
export type TimeBand = (typeof TIME_BANDS)[number];
export const LENGTH_BANDS = ["under_40", "forty_plus"] as const;
export type LengthBand = (typeof LENGTH_BANDS)[number];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The time band is set by the start time in India: before 18:00, from 18:00 to 21:00, and after 21:00.
export function timeBandOf(startedAt: number): TimeBand {
  const hour = new Date(startedAt + IST_OFFSET_MS).getUTCHours();
  if (hour < 18) return "before_18";
  if (hour < 21) return "evening";
  return "night";
}

// The length band: under 40 minutes, or 40 minutes or more.
export const lengthBandOf = (minutes: number): LengthBand => (minutes < 40 ? "under_40" : "forty_plus");

// Whether a stay of this many minutes asks for the card.
export const asksForCard = (source: "hour" | "desk", minutes: number): boolean => minutes >= (source === "hour" ? HOUR_MIN_MINUTES : DESK_MIN_MINUTES);
