// Who may see which kind of a student's data (spec house/0005, AC-7, AC-8, AC-23). One pure function, `canView`, and the tables it needs. No
// database and no clock. Every room calls this (or `staffRead` and `classTotal`, which call it) for anything it shows to someone other than the
// student, so every later room follows the same wall instead of inventing its own.

// The kinds of data a student has. `profile` is the roster (name, email, class, under 18): staff run access with it, it is not "viewed" through
// the wrapper, and `canView` gives staff nothing for it. The others are room data.
export const DATA_KINDS = ["profile", "academic", "mood", "meals", "habits", "sleep", "writing", "desk", "hour", "modules", "brain", "counsel"] as const;
export type DataKind = (typeof DATA_KINDS)[number];

// What each kind is. `academic` is exam results (named to a teacher and the institute). `wellbeing` is a feeling or a habit, which the institute
// sees only as class totals. `private` is the student's own words, which only they see. `profile` is the roster.
export type KindClass = "profile" | "academic" | "wellbeing" | "private";
export const KIND_CLASS: Readonly<Record<DataKind, KindClass>> = {
  profile: "profile",
  academic: "academic",
  mood: "wellbeing",
  meals: "wellbeing",
  habits: "wellbeing",
  sleep: "wellbeing",
  hour: "wellbeing",
  modules: "wellbeing",
  writing: "private",
  desk: "private",
  // The Brain's daily values and the patterns read from them (spec house/0019): worked out from every other room, and shown to the student alone.
  brain: "private",
  // A counseling booking (spec house/0024): the student's and the counselor they booked, read only through counsel.ts, never by school staff.
  counsel: "private",
};

// Each room registers the kind codes its data uses (AC-8). This is the code to room table: a test fails if a room is missing or a kind has no room.
// `test` is the event log's own test room and holds no student data.
export const ROOM_KINDS: Readonly<Record<string, readonly DataKind[]>> = {
  mood: ["mood"],
  meals: ["meals"],
  habits: ["habits"],
  sleep: ["sleep"],
  exams: ["academic"],
  modules: ["modules"],
  blog: ["writing"],
  desk: ["desk"],
  hour: ["hour"],
  brain: ["brain"],
  counsel: ["counsel"],
  test: [],
};

// Who is looking, and how they relate to the student.
export type Viewer = "student" | "teacher" | "institute_admin" | "dhi_admin" | "counselor" | "parent";
// `self` for the student, `assigned_class` for a teacher of the student's current class, `same_institute` for an institute admin of the student's
// institute, `none` for anything else (another institute, an unassigned class).
export type Relation = "self" | "assigned_class" | "same_institute" | "none";

// What the viewer gets: `full` (the student's own), `named` (by student name), `totals` (class totals of 10 or more, through `classTotal`),
// `summary` (a parent's, only when the student turned sharing on), or `none`.
export type Reach = "full" | "named" | "totals" | "summary" | "none";

// The target's standing. Anyone who is withdrawn, removed, erased or not yet through consent is invisible to everyone but themselves (AC-7).
export type Standing = "ok" | "locked" | "removed" | "erased";

export type ViewTarget = { standing: Standing; parentLevel?: "none" | "summary" };

// The table of the design:
//
//   viewer                              academic   mood meals habits sleep hour modules   writing desk
//   the student, of their own           full       full                                    full
//   teacher of a currently assigned     named      none                                    none
//   institute admin, same institute     named      totals                                  none
//   DHI admin                           none       none                                    none
//   counselor                           none       none                                    none
//   parent, through the student's own link: nothing unless the student turned sharing on, and then a summary of the Brain only (spec house/0022)
//     (no academic, mood, meals, habits, sleep, hour, modules, writing or desk)
export function canView(viewer: Viewer, relation: Relation, kind: DataKind, target: ViewTarget): Reach {
  if (viewer === "student") return relation === "self" ? "full" : "none";
  if (target.standing !== "ok") return "none";
  // The weekly parent page (spec house/0022): only the Brain's summary (days logged and the three lamp values), and only when the student turned
  // sharing on. A parent has no relation to check: they hold the student's own secret link, which `parentReport.open` resolves to the student. This
  // comes before the private kinds check below on purpose: the Brain is private to every other viewer, and this is the one summary the student opens.
  if (viewer === "parent") return kind === "brain" && target.parentLevel === "summary" ? "summary" : "none";
  const cls = KIND_CLASS[kind];
  if (cls === "profile" || cls === "private") return "none";
  switch (viewer) {
    case "teacher":
      return relation === "assigned_class" && cls === "academic" ? "named" : "none";
    case "institute_admin":
      if (relation !== "same_institute") return "none";
      return cls === "academic" ? "named" : "totals";
    case "dhi_admin":
    case "counselor":
      return "none";
  }
}

// A class total of any kind but named academic results is shown only when at least this many students stand behind it (AC-23).
export const MIN_TOTAL = 10;

export const isDataKind = (text: unknown): text is DataKind => typeof text === "string" && (DATA_KINDS as readonly string[]).includes(text);
// The kinds a class total may be asked for: the wellbeing ones, never academic (named) and never private.
export const TOTAL_KINDS: readonly DataKind[] = DATA_KINDS.filter((k) => KIND_CLASS[k] === "wellbeing");
