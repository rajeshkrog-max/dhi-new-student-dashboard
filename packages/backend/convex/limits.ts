// The per student call limits (spec 0003, AC-11), kept by the rate limiter component: 10 calls an hour for each of
// the two save functions. The key is always the student id found from the session, never anything the request sends.
// A function that throws rolls the count back too, so leads.submit and feedback.submit return a result object for
// every expected refusal (the count then stays), and throw only for not_signed_in and no_profile.
import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { SHARE_BAD_SHARDS, SHARE_MAKE_PER_HOUR, SHARE_READ_PER_MINUTE, SHARE_READ_SHARDS } from "./shareCore";
import { TEAM_OPEN_PER_HOUR } from "./teamCore";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  submitLead: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  submitFeedback: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  // The report copy (spec 0006, AC-10): 10 copies a student may queue an hour (used only when a job is really queued),
  // and at most 1500 jobs started a day across everyone (used when a job starts, key "all").
  reportCopy: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  reportCopyDay: { kind: "fixed window", rate: 1500, period: DAY },
  // The team link to the saved report (spec 0008, AC-6): one team member opens at most 200 PDFs in a fixed hour window.
  // Key = the signed in team email. Used only when a PDF is about to be served.
  teamOpen: { kind: "fixed window", rate: TEAM_OPEN_PER_HOUR, period: HOUR },
  // The profile picture (spec 0011, AC-6): one check for a student every 10 minutes (key = student id), and at most 5000 fetches a
  // day across everyone (key "all"). Weekly re-checks also take a token from the 4000 a day pool, so a first fetch is never crowded out.
  avatarCheck: { kind: "token bucket", rate: 1, period: 10 * MINUTE, capacity: 1 },
  // Both are written by every fetch that is scheduled, so a launch day burst would conflict on one document. 10 shards spread the
  // writes; each shard holds a tenth of the day's count, so the total is the same, but near the cap a call can be refused while another
  // shard still has room, so the real day cap is a little under 5000 and the 1000 kept for first fetches is approximate. A refused
  // fetch just stays due, and it has already used the student's 10 minute token, so it waits for the next check.
  avatarDay: { kind: "fixed window", rate: 5000, period: DAY, shards: 10 },
  avatarRecheckDay: { kind: "fixed window", rate: 4000, period: DAY, shards: 10 },
  // The student's own Restore (spec 0011, AC-9) fetches again at once, so it cannot sit behind the 10 minute check above (a Remove
  // and a Restore right after a first fetch would find it empty). 3 an hour for each student stops a Remove/Restore loop from using up the day.
  avatarRestore: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  // The private report link (spec 0010, AC-11). Making or renewing: 20 an hour for each student (key = student id), taken before any
  // other check. Reading: 600 a minute for each link (key = the share id, only after the signature was checked), and one shared bucket
  // of 600 a minute for every bad code together (key "bad"), so a flood of made up codes never creates a key per code. Both are in 16
  // shards because every read writes its bucket, and 40 readers at once on one document lost the race on every retry (a 500). Each shard
  // holds a sixteenth of the 600, so near the cap a request can be refused a little early while another shard has room: the real cap is
  // a little under 600. `start: 0` makes every shard's window begin on the same clock minute: without it each shard picks its own random
  // start, they reset at different moments, and a 12 second burst was let through 650 times. If readers still lose the race, shareHttp
  // answers 429 slow_down.
  // Joining the challenge (spec 0017, AC-8): 5 tries an hour for each student (key = student id). Taken before the rules and ticks are
  // checked, so a refused try still counts; a switch off or an ended challenge answers first and uses no token.
  challengeJoin: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
  // The public code check (spec 0016, AC-2): 28 a minute for each visitor (key = the forwarder's hashed address). Four shards of 7, with
  // `start: 0` so they reset together (see the note on shareRead), so the real cap is a little under 28. One visitor's key can never use up
  // another visitor's tokens.
  referralCheck: { kind: "fixed window", rate: 28, period: MINUTE, shards: 4, start: 0 },
  // The house's people and invites (spec house/0002, AC-17, AC-19). Pressing Join: 10 an hour for each signed in person (key = the sign in
  // user id). Creating a class list: 10 an hour for each signed in person (key = the sign in user id). Refused invites for an address that is
  // already in use: 50 a day for each institute (key = the institute id, or the person's id for a DHI admin with no institute). Every one of
  // these is taken in a function that returns its refusals instead of throwing, so a refused try still counts.
  inviteClaim: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  inviteBatch: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  emailInUse: { kind: "fixed window", rate: 50, period: DAY },
  // Consent and data rights (spec house/0005, AC-17). Each is keyed by a member id found from the session. Agreeing: 10 an hour. Withdrawing and
  // restoring together: 10 an hour. Starting an export: 5 an hour. Recording parent consent: 20 calls an hour for each institute admin (a call is up
  // to 50 students). Each is taken in a function that returns its refusals instead of throwing, so a refused try still counts.
  consentAgree: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  consentWithdraw: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  dataExport: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
  parentRecord: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  // Every page of an export after the start, 300 an hour for each person, so starting a download at a later page (a made up cursor) cannot get
  // round the 5 an hour. A whole export of 100 row pages fits many times over. The sharing switch: 30 changes an hour for each student.
  dataExportPage: { kind: "token bucket", rate: 300, period: HOUR, capacity: 300 },
  sharingChange: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  // Saving the mood (spec house/0006, AC-10): 30 an hour for each student (key = the member id), taken for every attempt, so a refused save still counts.
  moodSave: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  // Saving the night (spec house/0008, AC-10): 30 an hour for each student (key = the member id), taken for every attempt, so a refused save still counts.
  sleepSave: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  // Adding a custom dish (spec house/0009): 10 an hour for each student. Logging a plate (spec house/0010): 60 an hour.
  foodAdd: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  // The film calls (spec house/0013): the play link, the progress reports and the finish, 900 an hour for each student. A film reported every
  // five seconds is 720 an hour, so a long film fits.
  filmCall: { kind: "token bucket", rate: 900, period: HOUR, capacity: 900 },
  // The study hour (spec house/0015): entering or changing a seat, 60 an hour; chat, 20 a minute; the heartbeat, 300 an hour (one every 20 seconds
  // is 180 an hour).
  hourSeat: { kind: "token bucket", rate: 60, period: HOUR, capacity: 60 },
  hourChat: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  hourBeat: { kind: "token bucket", rate: 300, period: HOUR, capacity: 300 },
  mealLog: { kind: "token bucket", rate: 60, period: HOUR, capacity: 60 },
  // The exams sitting (spec house/0012): starting, keeping an answer, opening a hint, submitting and accepting the feedback, 1200 an hour for each
  // student (key = the member id). A long answer is kept every few seconds while the student types, so a whole sitting fits many times over.
  examWrite: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 300 },
  // A teacher opening a paper's marking page (spec house/0011): each open writes one look record for every student on the page, so it is held to 120
  // an hour for each teacher (key = the member id).
  staffOpen: { kind: "token bucket", rate: 120, period: HOUR, capacity: 60 },
  // The Brain (spec house/0020): hiding or showing a pattern, 30 an hour for each student (key = the member id).
  brainHide: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  // The blog (spec house/0014): 6 new posts an hour and 30 comments an hour for each student (key = the member id).
  blogPost: { kind: "token bucket", rate: 6, period: HOUR, capacity: 6 },
  blogComment: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  // Asking for a place to upload a post's photo: 12 an hour for each student (key = the member id).
  blogPhoto: { kind: "token bucket", rate: 12, period: HOUR, capacity: 12 },
  // The habits room (spec house/0007, AC-11): adding, ticking, undoing and removing together 60 an hour for each student (key = the member id), and
  // 10 new habits a day (a window that begins at 04:00 India time, the house day), so cycles of add and remove cannot fill the log's 500 events a day. The write limit is taken for every attempt; the daily one only for a habit that would really be made.
  habitWrite: { kind: "token bucket", rate: 60, period: HOUR, capacity: 60 },
  habitAddDay: { kind: "fixed window", rate: 10, period: DAY, start: Date.parse("2026-01-01T04:00:00+05:30") },
  // The weekly parent page (spec house/0022). Making or renewing the link: 10 an hour for each student (key = the member id), taken for every attempt.
  // Opening: 60 a minute for each link (key = the link id, only after the code matched). Bad codes together: one bucket of 120 a minute (key "bad") in 4
  // shards with `start: 0` (see the note on shareRead), so a flood of made up codes never creates a key per code.
  parentMake: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  parentOpen: { kind: "fixed window", rate: 60, period: MINUTE },
  parentBad: { kind: "fixed window", rate: 120, period: MINUTE, shards: 4, start: 0 },
  // The DHI desk (spec house/0016): questions that may reach the model, 30 an hour for each student (key = the member id), taken for every attempt. Clarify,
  // which is free, has its own 20 an hour so it cannot be used to run the model up.
  // Linking the DhiRise check to the house account (the student's own tap): 10 tries an hour for each student.
  funnelLink: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  deskAsk: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
  deskClarify: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  shareMake: { kind: "fixed window", rate: SHARE_MAKE_PER_HOUR, period: HOUR },
  shareRead: { kind: "fixed window", rate: SHARE_READ_PER_MINUTE, period: MINUTE, shards: SHARE_READ_SHARDS, start: 0 },
  shareBad: { kind: "fixed window", rate: SHARE_READ_PER_MINUTE, period: MINUTE, shards: SHARE_BAD_SHARDS, start: 0 },
});
