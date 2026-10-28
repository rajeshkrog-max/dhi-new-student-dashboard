import { codeOf, refusalWords } from "./house-words.ts";

// The new words of the sleep room (spec house/0008, AC-8 and AC-11): a failure line for each refusal of the server, the "night moved on" notice,
// the labels of the read back and the "not logged" mark. They are drafts until the owner approves them: the screen says so while
// SLEEP_WORDS_APPROVED is false. No word here calls a night short, long, good, bad or enough, and no word sets a target.
// Approved by the owner on 2026-10-28 ("approve all the words gates"). A change of the words after this is the owner's to approve again.
export const SLEEP_WORDS_APPROVED = true;

const SLEEP_REFUSALS: Record<string, string> = {
  bad_time: "Please pick a bed time in steps of 15 minutes.",
  bad_length: "A night can be from 1 to 16 hours, in steps of 15 minutes.",
  too_many_changes: "You have changed this night many times. It stays as it is now.",
  rate_limited: "That was too many taps for now. Please wait a little and try again.",
  member_inactive: "Your access is paused. Please ask your institute.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};

export function sleepRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && SLEEP_REFUSALS[code]) || refusalWords(code);
}

export const NIGHT_MOVED_ON = "The night moved on. This is saved for the new night.";
export const NOT_LOGGED = "Not logged";
export const SAVED = "Saved";
export const SAVE = "Save this night";
export const USUAL_BEDTIME = "Usual bedtime";
export const AVERAGE_LENGTH = "Average length";
export const FEW_NIGHTS = "A few more nights and this shows here.";
export const LAST_NIGHT = "Last night";
export const DRAFT_NOTE = "Draft words. The new notices on this page are not approved yet.";

export const LOADING = "Loading your nights…";
export const BED_EARLIER = "Bed 15 minutes earlier";
export const BED_LATER = "Bed 15 minutes later";
export const WAKE_EARLIER = "Wake 15 minutes earlier";
export const WAKE_LATER = "Wake 15 minutes later";
export const BED_LABEL = "Bed";
export const WAKE_LABEL = "Wake";
export const WEEK_TITLE = "Last 7 nights";
export const TRACK_NOTE = "The track runs from noon to noon. A quiet dot is a night not logged.";

// Every new line, for the copy test.
export const NEW_LINES: string[] = [
  ...Object.values(SLEEP_REFUSALS),
  NIGHT_MOVED_ON,
  NOT_LOGGED,
  SAVED,
  SAVE,
  USUAL_BEDTIME,
  AVERAGE_LENGTH,
  FEW_NIGHTS,
  LAST_NIGHT,
  DRAFT_NOTE,
  LOADING,
  BED_EARLIER,
  BED_LATER,
  WAKE_EARLIER,
  WAKE_LATER,
  BED_LABEL,
  WAKE_LABEL,
  WEEK_TITLE,
  TRACK_NOTE,
];
