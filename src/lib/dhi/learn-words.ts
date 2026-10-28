import { codeOf, refusalWords } from "./house-words.ts";

// The words of the desk's Learn panel (house spec 0031; Desk Design D3 to D5): the topic map and search, practice, Fix, Remember, written answers, Use it
// and the study plan. They are drafts under the desk's gate (DESK_WORDS_APPROVED in desk-words.ts) until the owner approves them. No word labels a
// student, ranks one or compares two: a topic's step says what comes next on that topic, never what the student is.

const LEARN_REFUSALS: Record<string, string> = {
  exam_open: "The desk is closed while a paper is open. It opens again when you hand in.",
  bad_topic: "That topic is not one of your class's topics.",
  no_questions: "There are no practice questions on this topic yet. Your teacher can add some to the question bank.",
  nothing_to_fix: "Nothing to go back over right now. Wrong answers come here once the paper has closed for everyone.",
  nothing_due: "Nothing is due to remember today. Topics come back 1, 3, 7 and 21 days after you answer them.",
  not_in_round: "That question is not part of this round. Please start again.",
  answered: "You have answered that one already.",
  bad_choice: "Please pick one of the options.",
  bad_day: "Pick a test day from tomorrow up to 30 days ahead.",
  bad_subject: "Please pick a subject.",
  bad_answer: "Please write an answer of up to 1500 letters.",
  not_enough_coins: "Marking an answer takes 2 coins and you have none left this month. Your teacher can still mark it: no coin is needed when the desk is off.",
  desk_my_day_full: "You have used today's questions to the desk. Please try again tomorrow. No coin was taken.",
  desk_day_full: "The desk has answered all it can today. Please try again tomorrow. No coin was taken.",
  not_marked: "This answer has not been marked yet.",
  slow_down: "That was a lot at once. Please wait a moment and try again.",
  rate_limited: "That was a lot at once. Please wait a moment and try again.",
  busy: "The desk is busy. Nothing was taken. Please try again in a moment.",
  not_found: "That was not found.",
};

export function learnRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && LEARN_REFUSALS[code]) || refusalWords(code);
}

export const TAB_ASK = "Ask";
export const TAB_LEARN = "Learn";
export const LEARN_INTRO = "Find a topic of your class, practise it, go back over what went wrong, and remember it later. None of this uses coins, except having a written answer marked.";
export const SUMMARY = (due: number, fix: number, held: number) =>
  `${due === 1 ? "1 topic" : `${due} topics`} to remember today · ${fix === 1 ? "1 answer" : `${fix} answers`} to go back over · ${held === 1 ? "1 topic" : `${held} topics`} holding in memory`;
export const REMEMBER = "Remember (due today)";
export const FIX = "Go back over wrong answers";
export const SEARCH_LABEL = "Find a topic";
export const SEARCH_PLACEHOLDER = "For example: fractions, or chapter 4";
export const SUBJECT_PICK = "Subject";
export const ALL_SUBJECTS = "All subjects";
export const NO_TOPICS = "No topics yet. Topics come from your class's papers, the question bank and the syllabus your teachers add.";
export const NO_CHAPTER = "Other topics";
export const STEP_WORDS: Record<string, string> = {
  new: "Not tried yet",
  practising: "Practising",
  held: "Holding in memory",
};
export const DUE_NOW = "Due to remember";
export const FIX_COUNT = (n: number) => (n === 1 ? "1 to go back over" : `${n} to go back over`);
export const OPEN_TOPIC = (name: string) => `Open ${name}`;
export const BACK = "Back to topics";
export const PRACTISE = "Practise (5 questions)";
export const FIX_TOPIC = "Go back over this topic's wrong answers";
export const WRITTEN = "Write an answer";
export const USE_IT = "Where is this used? (2 coins)";
export const USE_NOTE = "The desk tells you two or three places this idea shows up in daily life. A classmate's earlier answer comes free.";
export const ROUND_TITLE: Record<string, string> = { practice: "Practice", fix: "Going back over", recall: "Remembering" };
export const QUESTION_OF = (i: number, n: number) => `Question ${i} of ${n}`;
export const CHECK = "Check";
export const RIGHT = "Right.";
export const NOT_YET = (option: string) => `Not this time. The right answer is: ${option}`;
export const MASTERED = "This topic is now holding in memory. It will still come back to remember.";
export const NEXT = "Next question";
export const DONE = "Round done";
export const DONE_NOTE = "Wrong answers wait for you under Go back over. Topics come back to remember after 1, 3, 7 and 21 days.";
export const CLOSE_ROUND = "Close";
export const WRITTEN_TITLE = "Write an answer";
export const WRITTEN_NONE = "No written questions on this topic yet.";
export const WRITTEN_PICK = "Question";
export const WRITTEN_LABEL = "Your answer";
export const WRITTEN_SEND = "Send for marking (2 coins)";
export const WRITTEN_NOTE =
  "The desk marks your answer against your teacher's key points. When it is unsure, or you ask, a teacher of your class marks it instead. Your teacher sees the answer, not your name.";
export const WRITTEN_SENT: Record<string, string> = {
  done: "Marked. See it below.",
  teacher: "Sent to a teacher of your class. The mark shows below once they have looked.",
};
export const MY_ANSWERS = "Your written answers";
export const MARKS = (got: number | null, max: number) => (got === null ? `Not marked yet, out of ${max}` : `${got} of ${max} marks`);
export const BY_TEACHER = "Marked by your teacher";
export const BY_DESK = "Marked by the desk";
export const WAITING = "Waiting for a teacher";
export const MARKING = "Being marked…";
export const POINT_WORDS: Record<string, string> = { covered: "Covered", partly: "Partly there", missing: "Missing" };
export const ASK_TEACHER = "Ask a teacher to look";
export const PLAN_TITLE = "Plan for a test";
export const PLAN_DAY = "Test day";
export const PLAN_MAKE = "Make my plan";
export const PLAN_REMOVE = "Remove this plan";
export const PLAN_NONE = "Pick a subject and the day of your test, and the desk lays out which topics to do each day.";
export const PLAN_EMPTY = "There are no topics in this subject yet, so there is nothing to plan.";
export const PLAN_STEP: Record<string, string> = { fix: "go back over", remember: "remember", practise: "practise" };
export const PLAN_FOR = (day: string) => `Plan up to your test on ${day}`;
export const LEARN_LOADING = "Loading your topics…";
export const RESOLVED = "This solved my doubt";
export const RESOLVED_DONE = "Marked as solved";

export const LEARN_LINES: string[] = [
  ...Object.values(LEARN_REFUSALS),
  TAB_ASK,
  TAB_LEARN,
  LEARN_INTRO,
  SUMMARY(2, 1, 3),
  REMEMBER,
  FIX,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SUBJECT_PICK,
  ALL_SUBJECTS,
  NO_TOPICS,
  NO_CHAPTER,
  ...Object.values(STEP_WORDS),
  DUE_NOW,
  FIX_COUNT(2),
  BACK,
  PRACTISE,
  FIX_TOPIC,
  WRITTEN,
  USE_IT,
  USE_NOTE,
  ...Object.values(ROUND_TITLE),
  CHECK,
  RIGHT,
  NOT_YET("two"),
  MASTERED,
  NEXT,
  DONE,
  DONE_NOTE,
  CLOSE_ROUND,
  WRITTEN_TITLE,
  WRITTEN_NONE,
  WRITTEN_LABEL,
  WRITTEN_SEND,
  WRITTEN_NOTE,
  ...Object.values(WRITTEN_SENT),
  MY_ANSWERS,
  MARKS(3, 4),
  BY_TEACHER,
  BY_DESK,
  WAITING,
  MARKING,
  ...Object.values(POINT_WORDS),
  ASK_TEACHER,
  PLAN_TITLE,
  PLAN_DAY,
  PLAN_MAKE,
  PLAN_REMOVE,
  PLAN_NONE,
  PLAN_EMPTY,
  ...Object.values(PLAN_STEP),
  LEARN_LOADING,
  RESOLVED,
  RESOLVED_DONE,
];
