import { codeOf, refusalWords } from "../house-words.ts";

// The new words of the habits room (spec house/0007, AC-12): a failure line for each refusal of the server, the "day moved on" notice and the labels
// for a habit that starts later and for finished habits. They are drafts until the owner approves them: the screen says so while
// HABIT_WORDS_APPROVED is false. The tips, the insight lines and the milestones are the ones the room already had.
export const HABIT_WORDS_APPROVED = false;

const HABIT_REFUSALS: Record<string, string> = {
  bad_title: "Please write a short name for the habit, on one line, up to 40 characters.",
  bad_habit: "Please pick one of the suggestions or write your own.",
  bad_color: "Please pick one of the colours.",
  bad_window: "A habit can start today or up to 14 days ahead, and run for up to 90 days.",
  too_many_habits: "You already have five habits. Remove one to make room.",
  too_many_adds: "That is many new habits for one day. Please try again tomorrow.",
  too_many_flips: "You have changed this one many times today. Let it rest until tomorrow.",
  not_open: "This habit is not open today.",
  not_found: "We could not find that habit.",
  rate_limited: "That was too many taps for now. Please wait a little and try again.",
  day_full: "Today is full for now. Please try again tomorrow.",
  member_inactive: "Your access is paused. Please ask your institute.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};

export function habitRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && HABIT_REFUSALS[code]) || refusalWords(code);
}

export const DAY_MOVED_ON = "The day moved on. Today's ticks start fresh.";
export const startsOn = (pretty: string) => `Starts ${pretty}`;
export const FINISHED_TITLE = "Finished";
export const FINISHED_NOTE = "These ran their course. Their days stay as they were.";
export const DRAFT_NOTE = "Draft words. The new notices on this page are not approved yet.";

// Every new line, for the copy test.
export const NEW_LINES: string[] = [...Object.values(HABIT_REFUSALS), DAY_MOVED_ON, startsOn("1 Jan"), FINISHED_TITLE, FINISHED_NOTE, DRAFT_NOTE];
