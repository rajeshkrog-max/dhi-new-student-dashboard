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
  members: { owner: "house", class: "patched", retention: "Until erased; then a tombstone with no name or email, kept as the proof of the consent that applied. A member removed for 12 months is erased." },
  teacherClasses: { owner: "house", class: "erased", retention: "Deleted when the teacher is erased." },
  invites: { owner: "house", class: "patched", retention: "Pending invites are revoked and every invite for an erased person's email loses its name and email." },
  accessLog: { owner: "house", class: "kept", retention: "Kept. Ids and fixed codes only." },
  consentRecords: { owner: "house", class: "kept", retention: "Kept after an erase as the proof of what was agreed. Ids, codes and a wording version only." },
  sharingSettings: { owner: "house", class: "erased", retention: "Deleted when the student is erased." },
  viewLog: { owner: "house", class: "kept", retention: "Kept for 3 years, then deleted by the daily sweep. Ids and codes only." },
  houseErasures: { owner: "house", class: "kept", retention: "Kept. The receipt of an erase: counts only, no student id." },
  houseErasedEmails: { owner: "house", class: "system", retention: "Deleted when the 30 day block ends. A keyed hash, never the email." },
  classTotals: { owner: "house", class: "kept", retention: "Kept. The first answer of a class total for one complete month: a class, a kind and a count, no person in it." },
  events: { owner: "house", class: "erased", retention: "Deleted when the student is erased." },

  // The shared wording of every consent version (the funnel's and the house's). No person in it.
  consentTexts: { owner: "platform", class: "kept", retention: "Kept. The exact wording of each version; no person in it." },
};

// The version of the file a student downloads (spec house/0005, AC-12). A change of its shape is a new version.
export const EXPORT_SCHEMA = "dhi-house-export-v1";
