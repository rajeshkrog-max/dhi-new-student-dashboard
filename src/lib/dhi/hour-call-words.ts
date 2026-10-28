import { codeOf, refusalWords } from "./house-words.ts";

// The words of the study hour call (house spec 0027). Drafts until the owner approves them: the screens say so while HOUR_CALL_WORDS_APPROVED is
// false. Every call is recorded (owner, 2026-10-28), and the words say so, and who may watch, before anyone joins. No word labels or ranks a student.
// Approved by the owner on 2026-10-28 ("approve all the words gates"). A change of the words after this is the owner's to approve again.
export const HOUR_CALL_WORDS_APPROVED = true;

export const HOUR_CALL_WORDS = {
  draft: "These words are drafts and may change.",
  title: "Study together on camera",
  intro: "Join the call to study with your school's students in this hour. Your camera and microphone start off; turn them on when you like.",
  recordedNotice:
    "This call is recorded. Your school's teachers and the DHI team can watch the recording for 30 days, and may share it with a student who asks. Only students of your school are in this call.",
  join: "Join the call",
  joining: "Joining…",
  leave: "Leave the call",
  recordedNow: "Recording is on.",
  recordingSoon: "Recording starts in a moment.",
  microphone: "Microphone",
  camera: "Camera",
  shareScreen: "Share screen",
  loading: "Getting the call ready…",
  failed: "The call could not start just now. Please try again in a moment.",
  people: "In the call",
  mute: "Mute",
  remove: "Remove",
  moderating: "You are in this call as a moderator: you can mute a person or remove them from this call.",
  // Staff
  staffTitle: "Study hour calls",
  staffIntro: "Join the open hour to keep it a good place to study, and watch any recording of the last 30 days. Each time you open a recording, the students of that hour see it in Your data.",
  institute: "Institute",
  chooseInstitute: "Choose an institute",
  noOpenHour: "No study hour is open right now.",
  joinModerate: "Join to moderate",
  recordedTitle: "Recorded hours",
  noRecorded: "No hour of the last 30 days had anyone seated.",
  seated: (n: number) => `${n} ${n === 1 ? "student" : "students"} seated`,
  recordings: "Recording",
  noRecordings: "No recording yet. It appears a little while after the hour ends, if anyone was in the call.",
  shareLabel: "Share with a student of this school who asked (their house email)",
  share: "Share",
  unshare: "Take back",
  sharedWith: "Shared with",
  sharedTitle: "Study hour recordings shared with you",
};

const REFUSALS: Record<string, string> = {
  not_open: "The study hour is not open right now.",
  not_live: "Sit Live to join the call.",
  calls_not_set_up: "Calls are not switched on yet. Please try again later.",
  calls_unavailable: "The call service did not answer. Please try again in a moment.",
  no_such_student: "No student of this school has that email.",
  too_many_shares: "This recording is shared with the most students it can be.",
};

export function hourCallRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && REFUSALS[code]) || refusalWords(code);
}
