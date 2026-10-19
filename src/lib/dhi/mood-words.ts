import { GUNA_OF, type Guna } from "@dhi/backend/moodRules";
import { codeOf, refusalWords } from "./house-words.ts";
import { THOUGHTS, type MoodKey } from "./mood-lines.ts";

// The words of the mood room (spec house/0006, AC-8). The 20 DHI lines are the ones already in the room (two for each mood); the day stores which
// of the two it got. The guna lines and the rhythm tips are NEW and are drafts until the owner approves them: the screen says so while
// MOOD_WORDS_APPROVED is false. They are never stored, so changing a word changes how past days read, and that is accepted. No clinical words,
// and no label on the student: a day leans toward a guna, a student is never called one.
export const MOOD_WORDS_APPROVED = false;

export const GUNA_WORDS: Record<Guna, { name: string; line: string; tip: string }> = {
  sattva: {
    name: "Sattva",
    line: "This day leaned toward sattva: clear, calm and settled.",
    tip: "Keep the evening simple. One quiet hour, soft light, and the phone put away before sleep.",
  },
  rajas: {
    name: "Rajas",
    line: "This day leaned toward rajas: busy, driven and full of motion.",
    tip: "Give the energy one place to go. Finish a single task, then take a short walk to let the day cool.",
  },
  tamas: {
    name: "Tamas",
    line: "This day leaned toward tamas: slow, heavy and wanting rest.",
    tip: "Be gentle with the body today. Water, light food, a little sun, and an early night.",
  },
};

export const gunaOf = (mood: MoodKey): Guna => GUNA_OF[mood];

// The DHI line of a day: one of the two lines for the mood, chosen by the stored index.
export function dhiLine(mood: MoodKey, lineIx: number): string {
  const bank = THOUGHTS[mood];
  return bank[Math.abs(lineIx) % bank.length];
}

// What the student reads when a save is refused. Anything not listed falls back to the house's plain words.
const MOOD_REFUSALS: Record<string, string> = {
  bad_mood: "Please pick one of the colours.",
  note_too_long: "That line is a little long. Please keep it to 500 characters.",
  too_many_changes: "You have changed today's colour many times. Let it rest, and come back tomorrow.",
  rate_limited: "That was too many saves for now. Please wait a little and try again.",
  day_full: "Today is full for now. Please try again tomorrow.",
  member_inactive: "Your access is paused. Please ask your institute.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};

export function moodRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && MOOD_REFUSALS[code]) || refusalWords(code);
}

// Every new line the room adds, for the copy test.
export const NEW_LINES: string[] = [...Object.values(GUNA_WORDS).flatMap((g) => [g.line, g.tip]), ...Object.values(MOOD_REFUSALS)];
