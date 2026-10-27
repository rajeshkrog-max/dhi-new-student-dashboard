// The data map (spec house/0005, AC-14): every house table with exactly one erase class and a retention note. A test fails if a table in
// the schema has no entry here, or an entry names a table that does not exist, so a new table cannot ship without somebody deciding what happens
// to it when a person is erased.
//
//   erased   the rows belong to a person and are deleted when they are erased
//   kept     the rows stay: they hold ids and codes only, or are the proof of what was agreed
//   patched  the row stays and the personal fields are emptied (the person becomes a tombstone)
//   system   infrastructure rows with no personal data in them
//
// The funnel's own tables are not listed here: its erase (funnel spec 0014, not built yet) owns them, and must apply the same sign in account rule
// (spec house/0005, AC-13). The guard test names the funnel tables, so a new table of either part cannot ship unclassified.
export type DataClass = "erased" | "kept" | "patched" | "system";
export type DataOwner = "house" | "funnel" | "platform";
export type DataMapEntry = { owner: DataOwner; class: DataClass; retention: string };

export const DATA_MAP: Readonly<Record<string, DataMapEntry>> = {
  // ---- The house ----
  institutes: { owner: "house", class: "kept", retention: "Kept. No person in it." },
  classes: { owner: "house", class: "kept", retention: "Kept. No person in it." },
  classPauses: { owner: "house", class: "kept", retention: "Kept. No person in it." },
  members: { owner: "house", class: "patched", retention: "Until erased; then a tombstone with no name or email, kept as the proof of the consent that applied. A member removed for 12 months is erased." },
  teacherClasses: { owner: "house", class: "erased", retention: "Deleted when the teacher is erased." },
  invites: { owner: "house", class: "patched", retention: "Pending invites are revoked and every invite for an erased person's email loses its name and email." },
  accessLog: { owner: "house", class: "kept", retention: "Kept. Ids and fixed codes only." },
  consentRecords: { owner: "house", class: "kept", retention: "Kept after an erase as the proof of what was agreed. Ids, codes and a wording version only." },
  sharingSettings: { owner: "house", class: "erased", retention: "Deleted when the student is erased." },
  funnelLinks: { owner: "house", class: "erased", retention: "Deleted when the student unlinks or is erased. The date the student linked their DhiRise check; nothing from the check itself. The funnel's own rows are not touched." },
  parentLinks: { owner: "house", class: "erased", retention: "A hash of the link code, never the code. Deleted when sharing is turned off, when the student removes the link, after 90 days, or when the student is erased." },
  viewLog: { owner: "house", class: "kept", retention: "Kept for 3 years, then deleted by the daily sweep. Ids and codes only." },
  houseErasures: { owner: "house", class: "kept", retention: "Kept. The receipt of an erase: counts only, no student id." },
  houseErasedEmails: { owner: "house", class: "system", retention: "Deleted when the 30 day block ends. A keyed hash, never the email." },
  classTotals: { owner: "house", class: "kept", retention: "Kept. The first answer of a class total for one complete month: a class, a kind and a count, no person in it." },
  habitPlans: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their habits: the kind, their own title, a colour and a window. Seen by the student alone." },
  habitChecks: { owner: "house", class: "erased", retention: "Deleted when the student is erased. One row for each habit and day ticked." },
  papers: { owner: "house", class: "kept", retention: "Kept. The teacher's paper: its title and questions, which hold no student's words." },
  paperQuestions: { owner: "house", class: "kept", retention: "Kept with the paper. The right answers and tags are the teacher's own material, and hold no student's words." },
  paperSends: { owner: "house", class: "kept", retention: "Kept. Ids, codes and times only; the student's link is the attempt row, which is erased with them." },
  paperAttempts: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their marks and remarks, and the paper they belong to." },
  blogPosts: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their own writing: the title, the tag, the cleaned body and the photo, and the photo's file is deleted with the post." },
  blogComments: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their own comments." },
  foods: { owner: "house", class: "kept", retention: "The catalog is kept: food names and numbers, no person. A student's own dishes (custom, or published, whose catalog copy has no owner) are in their download and deleted when they are erased." },
  mealPlates: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their own plates: the food, the count, the meal and the time." },
  films: { owner: "house", class: "kept", retention: "Kept. DHI's own films: titles and references, and no student." },
  filmChecks: { owner: "house", class: "kept", retention: "Kept with the film. DHI's own check questions and their right options, and no student." },
  filmProgress: { owner: "house", class: "erased", retention: "Deleted when the student is erased. How far they watched each film, and whether its score was written." },
  studyHours: { owner: "house", class: "kept", retention: "Kept. DHI's clock: an open time and a close time, and no student." },
  seats: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Where and when they sat in a study hour, and their mode." },
  chatMessages: { owner: "house", class: "erased", retention: "Deleted when the student is erased, and by the daily sweep after 30 days. Their own chat messages in a study hour, kept so a teacher can review them." },
  sleepNights: { owner: "house", class: "erased", retention: "Deleted when the student is erased. One row for each night: the bed time and the length. Seen by the student alone." },
  moodDays: { owner: "house", class: "erased", retention: "Deleted when the student is erased. The mood, their own few words and a line index. Seen by the student alone." },
  deskSettings: { owner: "house", class: "kept", retention: "Kept. The monthly coins DHI gives each student; no student in it." },
  counselSlots: { owner: "house", class: "kept", retention: "Kept. A counselor's open times; no student in it." },
  counselBookings: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their booking: the time, the counselor, their own note and the counselor's short summary. Seen by the student and that counselor only. Each call is recorded and transcribed on Stream (never in a DHI table); the recordings of the student's sessions are deleted on Stream when they are erased." },
  hourShares: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Which study hour recordings a teacher or DHI admin shared with this student; the recordings themselves stay on Stream for 30 days." },
  counselShares: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Who the counselor shared a session's recording with; the recording itself stays on Stream and is deleted there too." },
  deskDaily: { owner: "house", class: "system", retention: "Kept. How many desk questions reached the model on each day, for the whole deployment; no student in it." },
  deskWallets: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their coin balance and the month it was last topped up." },
  deskThreads: { owner: "house", class: "erased", retention: "Deleted when the student is erased. The title of each of their desk talks. Seen by the student alone." },
  deskTurns: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their questions to the desk and its answers, with the coins taken and the cost in tokens. Seen by the student alone." },
  deskCache: { owner: "house", class: "kept", retention: "Deleted 90 days after it was stored, by the daily sweep. A hash of the question (never its words) and an answer, with no student, scoped to one institute; a question with an email or a phone number is never stored." },
  deskSittings: { owner: "house", class: "erased", retention: "Deleted when the student is erased. When a run of desk questions began and ended, and the answer to the feeling card: the feeling, the focus and the subject. Seen by the student alone." },
  events: { owner: "house", class: "erased", retention: "Deleted when the student is erased." },
  brainDays: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Their daily values worked out from their events: numbers only, no words. Seen by the student alone." },
  brainHides: { owner: "house", class: "erased", retention: "Deleted when the student is erased. Which patterns they hid, and until when." },
  brainState: { owner: "house", class: "system", retention: "Infrastructure: where the rollup has read to, and the counts of the last nightly check. No person in it." },

  // The shared wording of every consent version (the funnel's and the house's). No person in it.
  consentTexts: { owner: "platform", class: "kept", retention: "Kept. The exact wording of each version; no person in it." },
};

// The version of the file a student downloads (spec house/0005, AC-12). A change of its shape is a new version.
export const EXPORT_SCHEMA = "dhi-house-export-v1";
