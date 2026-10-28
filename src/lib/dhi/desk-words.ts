import { codeOf, refusalWords } from "./house-words.ts";

// The words of the DHI desk (spec house/0016): a line for each refusal of the server, the care text, the labels of the screen and the note that the
// answers are written by a model. They are drafts until the owner approves them: the screen says so while DESK_WORDS_APPROVED is false. No word
// labels a student, ranks one or calls a question silly, and the care text points to people, not to the model.
export const DESK_WORDS_APPROVED = false;

const DESK_REFUSALS: Record<string, string> = {
  not_enough_coins:
    "You have no coins left this month. Questions you asked before still answer for free, and new coins come next month.",
  exam_open: "The desk is closed while a paper is open. It opens again when you hand in.",
  model_not_chosen: "The desk is not switched on yet. Please try again later.",
  busy: "The desk is busy with your other questions. No coin was taken. Please ask again in a moment.",
  desk_my_day_full:
    "You have asked all the new questions you can for today. Questions you asked before still answer for free. No coin was taken. Please come back tomorrow.",
  desk_day_full:
    "The desk has answered all the new questions it can for today. Questions you asked before still answer for free. No coin was taken. Please try again tomorrow.",
  not_open_yet: "That part of the desk is not open yet.",
  bad_question: "Please type a question of up to 600 letters, or a piece of writing of up to 1500 letters.",
  nothing_to_clarify: "Ask a question first, then you can ask for it to be said again.",
  thread_full: "This talk is full. Please start a new one.",
  model_failed: "The desk could not answer just now. No coin was taken. Please try again.",
  rate_limited: "That was too many questions for now. Please wait a little and try again.",
  expired: "That answer came too late and was not kept. No coin was taken. Please ask again.",
  not_found: "That talk was not found.",
};

export function deskRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && DESK_REFUSALS[code]) || refusalWords(code);
}

export const CARE_TEXT =
  "It sounds like things may feel very hard right now. Please tell a parent, a teacher or another grown up you trust, today. If you want to talk to someone right away, you can call Tele-MANAS on 14416, free, any time. You are not alone, and this desk is only a study helper.";

export const DESK_TITLE = "DHI desk";
export const DRAFT_NOTE = "Draft words. The words on this page are not approved yet.";
export const MODEL_NOTE =
  "Answers are written by a computer model and can be wrong. Check them with your book or your teacher.";
export const COINS_LABEL = "Coins left";
export const COIN_NOTE =
  "A new question costs 1 coin. Feedback on a piece of writing and a set of five practice questions cost 2 coins each, a longer set of ten costs 4, a short study story costs 5, and a simple diagram costs 8. A question someone asked before, and asking for an answer to be said again, cost nothing. Unused coins carry over to next month.";
export const MODE_ASK = "Ask a question";
export const MODE_WRITE = "Feedback on my writing";
export const WRITE_LABEL = "Your writing";
export const WRITE_PLACEHOLDER = "Paste or type a short piece you wrote";
export const WRITE_BUTTON = "Get feedback (2 coins)";
export const MODE_PAPER = "Practice questions";
export const PAPER_LABEL = "Topic";
export const PAPER_PLACEHOLDER = "For example: fractions, class 8";
export const PAPER_BUTTON = "Make practice questions (2 coins)";
export const PAPER_NOTE =
  "The desk writes five questions and no answers. Try them first, then use the button below to ask about an answer. That is free.";
export const MODE_MOCK = "Longer practice set";
export const MOCK_BUTTON = "Make ten questions (4 coins)";
export const MOCK_NOTE =
  "The desk writes ten questions with no timer, no marks and no answers. Answer them in your notebook, then use the button below to ask about an answer. That is free.";
export const MODE_STORY = "Study story";
export const STORY_LABEL = "Topic for the story";
export const STORY_BUTTON = "Write a story (5 coins)";
export const STORY_NOTE =
  "The desk writes a short story that explains your topic. Check the idea in your book, because a story simplifies things.";
export const MODE_DRAW = "Diagram";
export const DRAW_LABEL = "Topic for the diagram";
export const DRAW_PLACEHOLDER = "For example: parts of a plant cell";
export const DRAW_BUTTON = "Draw a diagram (8 coins)";
export const DRAW_NOTE =
  "The desk draws a simple labelled diagram. It can make mistakes, so check it against your book.";
export const MODE_USE = "Where is it used";
export const USE_NOTE = "Two or three places the idea shows up in daily life. A classmate's earlier answer on the same topic comes free.";
export const DRAW_ALT = "A diagram made by the desk";
export const WRITE_NOTE =
  "The desk tells you what works and what to improve. It does not rewrite your piece, so try the rewrite yourself.";
export const ASK_LABEL = "Your question";
export const ASK_PLACEHOLDER = "Type a study question";
export const ASK = "Ask";
export const ASKING = "Asking…";
export const CLARIFY = "Ask about the answer above (free)";
export const NEW_TALK = "New talk";
export const TALKS_TITLE = "Your talks";
export const NO_TALKS = "No talks yet. Ask your first question.";
export const DELETE_TALK = "Delete this talk";
export const FROM_STORE = "Answered from an earlier answer, 0 coins";
export const LOADING = "Loading the desk…";
export const OFF_NOTE = "The desk is not switched on yet.";
export const COINS_SPENT = (n: number) => (n === 1 ? "1 coin" : `${n} coins`);

// The after session card (spec house/0018, desk part).
export const CARD_TITLE = "How did that sitting feel?";
export const CARD_NOTE = (minutes: number) =>
  `You spent about ${minutes} minutes at the desk. Two taps, or skip it. A skip changes nothing.`;
export const FEEL_WORDS: Record<string, string> = {
  energised: "Energised",
  okay: "Okay",
  drained: "Drained",
};
export const FOCUS_LABEL = "Focus";
export const SUBJECT_LABEL = "Subject (you can leave this out)";
export const SUBJECT_WORDS: Record<string, string> = {
  maths: "Maths",
  science: "Science",
  english: "English",
  social: "Social",
  hindi: "Hindi",
  other: "Other",
};
// The topic pick after a subject (house spec 0028): only topics from the papers sent to the student's class. Optional.
export const TOPIC_LABEL = "Topic from your class's papers (you can leave this out)";
export const TOPIC_NONE = "No topics from your class's papers in this subject yet.";
// A paper question's subject in words: a code of the fixed list, or the words of an older paper as they were.
export const subjectWord = (subject: string): string => SUBJECT_WORDS[subject] ?? subject;
export const SAVE = "Save";
export const SKIP = "Skip";
export const CARD_FAIL = "We could not save that. You can skip this card.";
export const CARD_SKIP_FAIL = "We could not skip the card. Please try again.";

// Every new line, for the copy test.
export const NEW_LINES: string[] = [
  ...Object.values(DESK_REFUSALS),
  CARE_TEXT,
  DESK_TITLE,
  DRAFT_NOTE,
  MODEL_NOTE,
  COINS_LABEL,
  COIN_NOTE,
  MODE_ASK,
  MODE_WRITE,
  MODE_PAPER,
  MODE_DRAW,
  DRAW_LABEL,
  DRAW_PLACEHOLDER,
  DRAW_BUTTON,
  DRAW_NOTE,
  DRAW_ALT,
  MODE_USE,
  USE_NOTE,
  MODE_STORY,
  STORY_LABEL,
  STORY_BUTTON,
  STORY_NOTE,
  MODE_MOCK,
  MOCK_BUTTON,
  MOCK_NOTE,
  PAPER_LABEL,
  PAPER_PLACEHOLDER,
  PAPER_BUTTON,
  PAPER_NOTE,
  WRITE_LABEL,
  WRITE_PLACEHOLDER,
  WRITE_BUTTON,
  WRITE_NOTE,
  ASK_LABEL,
  ASK_PLACEHOLDER,
  ASK,
  ASKING,
  CLARIFY,
  NEW_TALK,
  TALKS_TITLE,
  NO_TALKS,
  DELETE_TALK,
  FROM_STORE,
  LOADING,
  OFF_NOTE,
  CARD_TITLE,
  CARD_NOTE(10),
  ...Object.values(FEEL_WORDS),
  FOCUS_LABEL,
  SUBJECT_LABEL,
  ...Object.values(SUBJECT_WORDS),
  TOPIC_LABEL,
  TOPIC_NONE,
  SAVE,
  SKIP,
  CARD_FAIL,
  CARD_SKIP_FAIL,
];
