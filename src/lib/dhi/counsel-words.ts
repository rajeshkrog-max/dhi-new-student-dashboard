import { codeOf, refusalWords } from "./house-words.ts";

// The words of counseling (spec house/0024). Drafts until the owner approves them: the screens say so while COUNSEL_WORDS_APPROVED is false. Every
// call is recorded and transcribed (owner, 2026-10-27), and the words say so before anyone joins. No word labels or ranks a student.
export const COUNSEL_WORDS_APPROVED = false;

export const COUNSEL_WORDS = {
  draft: "These words are drafts and may change.",
  title: "Talk to a counselor",
  intro: "A counselor from the DHI team can talk with you for 30 minutes, in a video call inside the house. Pick a free time below.",
  recordedNotice:
    "This call is recorded and written down as a transcript, so your counselor can look back at it. Only your counselor can see it, and they share it only if someone needs it and asks. Your school, your teachers and your parents do not see it.",
  recordedNow: "Recording is on.",
  recordingSoon: "Recording starts in a moment.",
  microphone: "Microphone",
  camera: "Camera",
  shareScreen: "Share screen",
  leave: "Leave the call",
  noteLabel: "A short note for your counselor (you can leave it empty)",
  notePlaceholder: "What would you like to talk about?",
  book: "Book this time",
  booked: "Booked. You can join the call from here 10 minutes before it starts.",
  freeTitle: "Free times",
  noFree: "No free times in the next two weeks yet. Please look again soon, or talk to a parent, a teacher or another grown up you trust.",
  mineTitle: "Your bookings",
  noMine: "You have no bookings yet.",
  join: "Join the call",
  joining: "Joining…",
  openCall: "Open the call",
  cancel: "Cancel",
  back: "Back",
  callLoading: "Getting the call ready…",
  callFailed: "The call could not start just now. Please try again in a moment.",
  summaryTitle: "Your counselor's note after the session",
  status: { booked: "Booked", ended: "Ended", cancelled_by_student: "You cancelled", cancelled_by_counselor: "The counselor cancelled", done: "Done" } as Record<string, string>,
  helpline: "If you need to talk to someone right now, you can call Tele-MANAS on 14416, free, any time.",
  // The counselor's screen
  slotsTitle: "Your times",
  openSlotLabel: "Open a 30 minute time",
  openSlot: "Open this time",
  closeSlot: "Take back",
  noSlots: "You have no times open. Open a time above and students can book it.",
  summaryLabel: "A short note after the session (only this student and you read it)",
  finish: "Save and mark done",
  recordings: "Recording and transcript",
  noRecordings: "No recording yet. It appears here a little while after the call ends.",
  shareLabel: "Share the recording with someone who asked (their house email)",
  share: "Share",
  unshare: "Take back the share",
  sharedWith: (n: number) => `Shared with ${n} ${n === 1 ? "person" : "people"}.`,
  sharedTitle: "Recordings shared with you",
};

export const COUNSEL_REFUSALS: Record<string, string> = {
  bad_time: "Please pick a time on the hour or the half hour.",
  too_soon: "That time has already passed.",
  too_far: "Times can be opened up to 60 days ahead.",
  slot_taken: "You already have that time open.",
  too_many_slots: "You have the most open times you can have. Take some back first.",
  booked: "Someone booked that time, so it cannot be taken back.",
  already_booked: "You already have a booking. Cancel it first if you want another time.",
  slot_gone: "Someone just booked that time. Please pick another.",
  note_too_long: "Please keep the note to 300 letters.",
  summary_too_long: "Please keep the note to 1000 letters.",
  started: "The session has started, so it cannot be cancelled.",
  not_started: "You can write the note once the session has started.",
  no_such_person: "Nobody in the house has that email.",
  already_yours: "That is your own email.",
  too_many_shares: "This recording is shared with the most people it can be.",
  call_closed: "The call opens 10 minutes before the time and closes 30 minutes after it ends.",
  calls_not_set_up: "Calls are not switched on yet. Please try again later.",
  calls_unavailable: "The call service did not answer. Please try again in a moment.",
};

// A booking's status as the screens show it: a booked session whose call window has closed reads as ended, whether or not it was marked done.
export function shownStatus(status: string, endsAt: number, now: number, closeAfterMs: number): string {
  const key = status === "booked" && now > endsAt + closeAfterMs ? "ended" : status;
  return COUNSEL_WORDS.status[key] ?? status;
}

export function counselRefusal(error: unknown): string {
  const code = typeof error === "string" ? error : codeOf(error);
  return (code && COUNSEL_REFUSALS[code]) || refusalWords(code);
}
