// The pure rules of the papers room (spec house/0011): the shape of a question, the limits, the window and the marks. No database and no clock,
// and no imports. The server and the tests read the same rules.

export const MAX_QUESTIONS = 50;
export const MAX_OPTIONS = 6;
export const MIN_OPTIONS = 2;
export const MAX_TITLE = 120;
export const MAX_TEXT = 500;
export const MAX_LABEL = 60;
export const MAX_OPTION_TEXT = 200;
export const MAX_RUBRIC = 500;
export const MAX_REMARKS = 1000;
export const MAX_HINT = 300;
export const MAX_MARKS = 100;
export const MAX_SPAN_DAYS = 14;
export const MIN_WINDOW_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const WRONG_TAGS = ["misread", "concept"] as const;
export type WrongTag = (typeof WRONG_TAGS)[number];

export type QuestionInput =
  | {
      kind: "mcq";
      subject: string;
      topic: string;
      text: string;
      options: string[];
      rightOption: number;
      // One entry per option: the tag of a wrong option (or null for no tag), and null for the right one.
      tags: (WrongTag | null)[];
      // An optional hint that helps a student think and never gives the answer (hintProblem).
      hint?: string;
    }
  | { kind: "long"; subject: string; topic: string; text: string; maxMarks: number; rubric: string; hint?: string };

// Trimmed, non empty, within a length. Returns the trimmed text or null.
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text.length === 0 || [...text].length > max) return null;
  return text;
}

export const isWrongTag = (value: unknown): value is WrongTag => typeof value === "string" && (WRONG_TAGS as readonly string[]).includes(value);

// The words of a text: lower case, every run of anything but letters, marks and digits made one space, and a space at each end, so a phrase is
// found only as whole words.
const spaced = (text: string): string => ` ${text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim()} `;

// Whether a hint gives a multiple choice answer away. It does when it holds the right option's words (as whole words, or as the characters themselves
// when the option has no letters or digits, like "+" or "=") or when it points at an option by its place: "option B", "choice 2", "(c)", "answer: D",
// "correct is 3". It also refuses a pointer at any OTHER option, because with two or three options "it is not option A" gives the answer away too.
// A hint that only helps a student think passes. This is a guard rail for a teacher's mistake, not a proof: the right answer never leaves the server.
const PLACE = "(?:[A-Fa-f]|[1-9])";
const POINTS_AT_OPTION = [
  // "option B", "option no. 2", "choice (c)", "option: 3", "option is B"
  new RegExp(`\\b(?:option|choice)\\b[\\s:=\\-\\u2013\\u2014]*(?:no\\.?|number|#)?[\\s:=\\-\\u2013\\u2014]*(?:is\\s*)?\\(?${PLACE}\\)?(?![\\p{L}\\p{N}])`, "iu"),
  // "answer: B", "answer is 3", "the answer's B", "correct: C", "right is 2" with a capital letter or a digit, so "answer a simpler question" is fine
  new RegExp(`\\b(?:[Aa]nswer|[Aa]ns|[Cc]orrect|[Rr]ight)(?:'s|\u2019s)?\\b[\\s:=\\-\\u2013\\u2014]*(?:is\\s*)?\\(?(?:[A-F]|[1-9])\\)?(?![\\p{L}\\p{N}])`, "u"),
  // a letter or a digit alone in brackets, "(b)" or "(2)"
  /\(\s*(?:[A-Fa-f]|[1-9])\s*\)/u,
];

export function hintGivesAnswer(hint: string, options: readonly string[], rightOption: number): boolean {
  const rightRaw = (options[rightOption] ?? "").trim();
  const right = spaced(rightRaw);
  const words = right.trim();
  if (words.length > 1 || /^\p{N}$/u.test(words)) {
    if (spaced(hint).includes(right)) return true;
  } else if (words.length === 0 && rightRaw.length > 0 && hint.toLowerCase().includes(rightRaw.toLowerCase())) {
    // An option made only of marks, like "+", has no words to find, so the marks themselves are looked for.
    return true;
  }
  // (An option that is a single letter is not looked for as a word, because "a" is in every sentence; the patterns below catch "option A".)
  return POINTS_AT_OPTION.some((pattern) => pattern.test(hint));
}

// A hint is optional, and a blank one counts as none. When there is one it is text of up to 300 characters, and for a multiple choice question
// (`options` given) it does not give the answer away. Returns the problem code or null.
export function hintProblem(hint: unknown, options: readonly string[] | null, rightOption: number): "bad_hint" | null {
  if (hint === undefined) return null;
  if (typeof hint === "string" && hint.trim() === "") return null;
  const text = cleanText(hint, MAX_HINT);
  if (text === null) return "bad_hint";
  return options !== null && hintGivesAnswer(text, options, rightOption) ? "bad_hint" : null;
}

// Checks one question. Returns the problem code or null. The code is fixed and never echoes the text.
export function questionProblem(q: unknown): "bad_question" | "bad_hint" | null {
  if (typeof q !== "object" || q === null) return "bad_question";
  const item = q as Record<string, unknown>;
  if (!cleanText(item.subject, MAX_LABEL) || !cleanText(item.topic, MAX_LABEL) || !cleanText(item.text, MAX_TEXT)) return "bad_question";
  if (item.kind === "mcq") {
    const options = item.options;
    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return "bad_question";
    if (!options.every((o) => cleanText(o, MAX_OPTION_TEXT) !== null)) return "bad_question";
    if (!Number.isInteger(item.rightOption) || (item.rightOption as number) < 0 || (item.rightOption as number) >= options.length) return "bad_question";
    const tags = item.tags;
    if (!Array.isArray(tags) || tags.length !== options.length) return "bad_question";
    for (let i = 0; i < options.length; i += 1) {
      if (i === item.rightOption) {
        if (tags[i] !== null && tags[i] !== undefined) return "bad_question";
      } else if (tags[i] !== null && tags[i] !== undefined && !isWrongTag(tags[i])) {
        // A wrong option may be tagged or left untagged (spec house/0011: the tag is optional).
        return "bad_question";
      }
    }
    return hintProblem(item.hint, options as string[], item.rightOption as number);
  }
  if (item.kind === "long") {
    const max = item.maxMarks;
    if (!Number.isInteger(max) || (max as number) < 1 || (max as number) > MAX_MARKS) return "bad_question";
    if (typeof item.rubric !== "string" || [...item.rubric].length > MAX_RUBRIC) return "bad_question";
    return hintProblem(item.hint, null, -1);
  }
  return "bad_question";
}

// The paper as a whole: a title, 1 to 50 questions, and each question valid.
export function paperProblem(title: unknown, questions: unknown): "bad_title" | "bad_question" | "bad_hint" | null {
  if (!cleanText(title, MAX_TITLE)) return "bad_title";
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_QUESTIONS) return "bad_question";
  for (const q of questions) {
    const problem = questionProblem(q);
    if (problem !== null) return problem;
  }
  return null;
}

// A window: the open time comes before the due time, at least a minute apart, and not more than 14 days long. When the caller passes the time it is now
// (a teacher sending a paper), the due time must also be at least a minute ahead, so a window that has already closed is never sent: it would be a
// miss for the whole class at the next sweep.
export function windowProblem(opensAt: number, dueAt: number, now?: number): "bad_window" | null {
  if (!Number.isFinite(opensAt) || !Number.isFinite(dueAt)) return "bad_window";
  if (dueAt - opensAt < MIN_WINDOW_MS) return "bad_window";
  if (dueAt - opensAt > MAX_SPAN_DAYS * DAY_MS) return "bad_window";
  if (now !== undefined && dueAt < now + MIN_WINDOW_MS) return "bad_window";
  return null;
}

// Whether a paper is open at a moment: from the open time up to the due time.
export const isOpenAt = (now: number, opensAt: number, dueAt: number): boolean => now >= opensAt && now < dueAt;

// A mark for a long answer: a whole number from 0 to the question's maximum.
export const markProblem = (mark: unknown, maxMarks: number): "bad_mark" | null =>
  Number.isInteger(mark) && (mark as number) >= 0 && (mark as number) <= maxMarks ? null : "bad_mark";

// The total of the marks, counting each question once. A question with no mark counts as nothing.
export function totalOf(marks: readonly { question: number; mark: number }[]): number {
  return marks.reduce((sum, m) => sum + m.mark, 0);
}
