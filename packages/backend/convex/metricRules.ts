// The pure rules of the Brain's daily values (spec house/0019, scope row 17; the Master Spec's calculation rules). No database and no clock. One
// student's events for one house day become, for each measure, a top part (`num`) and a bottom part (`den`), so a week is the sum of the tops over
// the sum of the bottoms and never an average of percentages. A day with nothing to measure gets no value at all (`undefined`), which is not a
// zero: a student who logged nothing is "not logged", and only a thing that was expected and did not happen (a habit that was open, a study hour
// that was open) is a real zero, and only once the day is over. The ids are the Master Spec's where it has one (A academic, E emotional, H health
// and consistency, C showing up); X01 is added for the minutes sat in a study hour. Words never appear here: a measure is a number.
import { PROCESSING } from "./foodRules";

// The catalog version. Bump it when any formula below changes: the stored days of an older version are rebuilt from the events.
// Version 2 (2026-10-22): C01 no longer counts a paper that closed unsat (a system event), and a "logged" day means the student did something.
// Version 3 (2026-10-24): 20 more measures from what the rooms already hold (mood swing and mix, note days, the blog's length, range, structure, tags and
// comments, meal times, late night study, rooms used in a day). A comment received and a missed paper are not the student's own doing and are not a log.
// Version 4 (2026-10-24): E09 and E10 also read the answers of the desk's after session card (`desk.felt`), beside the study hour's.
// Version 5 (2026-10-24): X02, the minutes at the desk. A plain measure (owner, 2026-10-24): it feeds no lamp and no home score, and a day with only desk
// time is not a logged day for the chains.
// Version 6 (2026-10-24): A10 (desk study days) and A12 (active learning share of desk sittings), plain measures like X02.
// Version 7 (2026-10-26): a day an open paper touched has no real zero for the study hour (H12, X01), because the exam lock closed it (owner,
// 2026-10-26; brainDay.ts with examLock.sittingWithin).
// Version 8 (2026-10-28): the tagged values for the connections P4 and P6 (`tagsOfDay`, house spec 0028), kept beside the measures.
// Version 9 (2026-10-28): 19 more of the Master Spec's measures (house spec 0030), plain measures that feed no lamp and no home score (owner, 2026-10-28):
// stress level and when it shows (E04, E07), why answers went wrong (A07), answer pace (A08), the paper gain (A20), asked for help (E17), the teacher's
// rubric (A03), habit feels (H10), the film checks (A16), help given (A19), doubts resolved (A18), and the desk's practice: recall after 7 days (A04), old
// mistakes fixed (A05), recall rounds (A13) and topics held (A09). The streak (H09), desk time by subject (A11), the film's effect (A17) and the weak topic
// follow up (A14) are worked out over a period from the days and their tags, at the end of this file.
export const METRIC_VERSION = 9;

// E06 is the mood mix, one measure for each family of moods; E15 the tags of the posts, one for each tag; H03 the meal times, one for each slot. The Master
// Spec keeps these as breakdowns of one id; here each key is its own id so a day stays one top and one bottom for each id.
export const METRIC_IDS = [
  "A01", "A02", "A06", "A10", "A12", "A15",
  "C01", "C02",
  "E01", "E02", "E03", "E05", "E06L", "E06S", "E06H", "E08", "E09", "E10", "E11", "E12", "E13", "E14", "E15S", "E15R", "E15Q", "E15I", "E16", "E16R",
  "H01", "H02", "H03B", "H03L", "H03S", "H03D", "H04", "H05", "H06", "H07", "H08", "H11", "H12",
  "X01", "X02",
  "E04", "E07P", "E07T", "E07O", "E17", "A03", "A04", "A05", "A07M", "A07C", "A07K", "A08", "A09", "A13", "A16", "A18", "A19", "A20", "H10",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];
export const isMetricId = (text: unknown): text is MetricId => typeof text === "string" && (METRIC_IDS as readonly string[]).includes(text);

export type Value = { num: number; den: number };
export type DayValues = Partial<Record<MetricId, Value>>;

// What a measure is, for the readers that need to know how to add it up. `share`: tops over bottoms. `count`: a number of things in a day.
// `clock`: a time of day, whose period value is the median and not a sum. `mean`: the mean of all individual answers.
export const METRIC_SHAPE: Readonly<Record<MetricId, "share" | "count" | "clock" | "mean">> = {
  A01: "share",
  A02: "share",
  A06: "share",
  A10: "count",
  A12: "share",
  A15: "count",
  C01: "share",
  C02: "count",
  E01: "share",
  E02: "share",
  E03: "share",
  E05: "mean",
  E06L: "share",
  E06S: "share",
  E06H: "share",
  E08: "share",
  E09: "share",
  E10: "mean",
  E11: "share",
  E12: "clock",
  E13: "clock",
  E14: "share",
  E15S: "share",
  E15R: "share",
  E15Q: "share",
  E15I: "share",
  E16: "count",
  E16R: "count",
  H01: "share",
  H02: "share",
  H03B: "clock",
  H03L: "clock",
  H03S: "clock",
  H03D: "clock",
  H04: "share",
  H05: "share",
  H06: "clock",
  H07: "clock",
  H08: "share",
  H11: "count",
  H12: "share",
  X01: "count",
  X02: "count",
  E04: "share",
  E07P: "share",
  E07T: "share",
  E07O: "share",
  E17: "count",
  A03: "mean",
  A04: "share",
  A05: "share",
  A07M: "share",
  A07C: "share",
  A07K: "share",
  A08: "mean",
  A09: "count",
  A13: "share",
  A16: "share",
  A18: "share",
  A19: "count",
  A20: "count",
  H10: "mean",
};

// Whether a day's value means the student did something. A zero of a thing that was expected and did not happen (a habit open and not ticked, a study
// hour open and not sat, a paper that closed unsat) is a real zero for the lamps, but it is not a log: a student who logged nothing has no logged days,
// and no chain may count a day that holds only such zeros. C01 is derived from the others and is not a log of its own.
export function didSomething(metric: MetricId, value: Value): boolean {
  if (metric === "C01" || metric === "C02" || metric === "E16R" || metric === "X02" || metric === "A10" || metric === "A12") return false;
  // Version 9: a measure worked out from another log of the same day (the mood, the paper), the teacher's rubric, the help a classmate marked and the desk's
  // practice (a desk day alone is not a logged day, owner 2026-10-24) are not a log of their own.
  if ((DERIVED as readonly string[]).includes(metric)) return false;
  if (metric === "H08" || metric === "H12" || metric === "X01" || metric === "A01") return value.num > 0;
  return true;
}
export const loggedOn = (values: DayValues): boolean => (Object.entries(values) as [MetricId, Value][]).some(([metric, value]) => didSomething(metric, value));

const DERIVED: readonly MetricId[] = ["E04", "E07P", "E07T", "E07O", "A03", "A04", "A05", "A07M", "A07C", "A07K", "A08", "A09", "A13", "A18", "A19", "A20"];

// The events a day is made from: the type, the payload and the time it happened. Only the current, not voided events of the day are given.
export type EventRow = { type: string; payload: Record<string, unknown>; occurredAt: number };

// The facts about the day that the events cannot say. A thing that was expected and did not happen is a zero only when the day is over.
export type DayFacts = {
  openHabits: number; // habits open on the day (their plan windows)
  hourOpen: boolean; // a study hour was open on the day
  finished: boolean; // the house day is over
  prevLightness?: number | undefined; // the lightness (1 to 5) of the mood on the student's previous logged day, for the mood swing
  paperDueNext?: boolean | undefined; // a paper of the student is due on the next house day (E07's "day before a paper")
};

// Events the student did not do: the system closes a paper unsat, and a teacher's approval brings a comment to the author of the post.
// Version 9 adds the teacher's rubric on a confirmed mark and a comment the post's author marked helpful.
const NOT_THE_STUDENTS: readonly string[] = ["exams.missed", "blog.replied", "exams.remarked", "blog.helped"];
export const STRESSED_MOODS: readonly string[] = ["stressed", "anxious"];
export const HEAVY_MOODS: readonly string[] = ["sad", "heavy"];
export const OKAY_FEELS: readonly string[] = ["energised", "okay"];
// The lightness of a mood, 1 to 5: used only inside formulas and never shown (Master Spec, mood swing E05). The families are for the mood mix (E06).
export const MOOD_LIGHTNESS: Readonly<Record<string, number>> = { best: 5, happy: 5, motivated: 4, determined: 4, content: 4, tired: 3, stressed: 2, anxious: 2, sad: 2, heavy: 1 };
export const MOOD_FAMILY: Readonly<Record<string, "L" | "S" | "H">> = { best: "L", happy: "L", motivated: "L", determined: "L", content: "L", tired: "S", stressed: "H", anxious: "H", sad: "H", heavy: "H" };
// A note of this many words or more makes a note day (E08).
export const NOTE_DAY_WORDS = 10;
// The meal slots of the meals room, each with its own meal time measure (H03).
export const MEAL_SLOT_METRIC: Readonly<Record<string, MetricId>> = { breakfast: "H03B", lunch: "H03L", snack: "H03S", dinner: "H03D" };
// Late night study begins at 23:00 on the house day's scale (H11).
export const LATE_NIGHT_HOUR = 23;
// 20 minutes in a study hour makes it a study room day (Master Spec H12).
export const HOUR_DAY_MINUTES = 20;
// E07: three hours of study (desk and study hour minutes) in a day make the "after 3 or more study hours" context.
export const STUDY_HOURS_MINUTES = 180;
// E04: the stress level is Low under 15% of logged days, Moderate from 15 to 35%, High over 35% (Master Spec). A word for the student, never a score.
export type StressBand = "low" | "moderate" | "high";
export const stressBandOf = (share: number | null): StressBand | null => (share === null ? null : share < 0.15 ? "low" : share <= 0.35 ? "moderate" : "high");
// The India clock, five and a half hours ahead of UTC.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The hour of the India clock for a moment, on the house day's scale: the small hours belong to the day before, so 01:00 reads as 25.
export function houseHour(ms: number): number {
  const hour = new Date(ms + IST_OFFSET_MS).getUTCHours();
  return hour < 4 ? hour + 24 : hour;
}

// The minute of the house day for a moment (the small hours read as 24:00 and later), so a dinner at 23:30 is 1410 and one at 01:00 is 1500.
export function houseMinute(ms: number): number {
  const d = new Date(ms + IST_OFFSET_MS);
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();
  return d.getUTCHours() < 4 ? minute + 24 * 60 : minute;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const rowsOf = (events: readonly EventRow[], type: string) => events.filter((e) => e.type === type);
const sumOf = (rows: readonly EventRow[], field: string): number => rows.reduce((sum, e) => sum + num(e.payload[field]), 0);

// All the measures of one day. `events` are the day's current events, in any order.
export function valuesOfDay(events: readonly EventRow[], facts: DayFacts): DayValues {
  const out: DayValues = {};

  // Mood: the day's one current mood. Stressed or anxious is E02, sad or heavy is E03.
  const moods = rowsOf(events, "mood.logged");
  if (moods.length > 0) {
    const mood = String(moods[moods.length - 1].payload.mood);
    out.E01 = { num: 1, den: 1 };
    out.E02 = { num: STRESSED_MOODS.includes(mood) ? 1 : 0, den: 1 };
    out.E03 = { num: HEAVY_MOODS.includes(mood) ? 1 : 0, den: 1 };
    // The mood mix (E06): the family of the day's mood. Moods the lists do not know leave the mix out.
    const family = MOOD_FAMILY[mood];
    if (family !== undefined) {
      out.E06L = { num: family === "L" ? 1 : 0, den: 1 };
      out.E06S = { num: family === "S" ? 1 : 0, den: 1 };
      out.E06H = { num: family === "H" ? 1 : 0, den: 1 };
    }
    // The mood swing (E05): how far the lightness moved since the previous logged day.
    const lightness = MOOD_LIGHTNESS[mood];
    if (lightness !== undefined && facts.prevLightness !== undefined) out.E05 = { num: Math.abs(lightness - facts.prevLightness), den: 1 };
    // Note days (E08): a note of 10 words or more. Only the number of words is kept; an event from before the count was kept leaves it out.
    const words = moods[moods.length - 1].payload.noteWords;
    if (typeof words === "number" && Number.isFinite(words)) out.E08 = { num: words >= NOTE_DAY_WORDS ? 1 : 0, den: 1 };
  }

  // Habits: H08 is 1 on a day with a tick. A day with an open habit and no tick is a real 0, once the day is over.
  const ticks = rowsOf(events, "habits.ticked");
  if (ticks.length > 0) out.H08 = { num: 1, den: 1 };
  else if (facts.finished && facts.openHabits > 0) out.H08 = { num: 0, den: 1 };

  // The study hour: the minutes sat (X01), and whether that made a study room day (H12). An hour that was open and not sat is a real 0.
  const present = rowsOf(events, "hour.present");
  if (present.length > 0 || (facts.finished && facts.hourOpen)) {
    const minutes = sumOf(present, "minutes");
    out.X01 = { num: minutes, den: 1 };
    out.H12 = { num: minutes >= HOUR_DAY_MINUTES ? 1 : 0, den: 1 };
  }
  // The desk: the minutes of the sittings that ended (X02). Only a sitting of a minute or more writes an event, so there is no real zero.
  const atDesk = rowsOf(events, "desk.present");
  if (atDesk.length > 0) out.X02 = { num: sumOf(atDesk, "minutes"), den: 1 };
  // The desk's sittings (A10, A12): a day with a sitting of 3 or more questions is a desk study day, and the share of the day's sittings that held an
  // active learning kind. Plain measures: no real zero, and a desk day alone is not a logged day.
  const sittings = rowsOf(events, "desk.mode");
  if (sittings.length > 0) {
    if (sittings.some((e) => Number(e.payload.turns) >= 3)) out.A10 = { num: 1, den: 1 };
    out.A12 = { num: sittings.filter((e) => Number(e.payload.active) > 0).length, den: sittings.length };
  }
  // Late night study room time (H11): the minutes of stays after 23:00. An event from before the count was kept leaves it out.
  const late = present.filter((e) => typeof e.payload.lateMinutes === "number");
  if (late.length > 0) out.H11 = { num: sumOf(late, "lateMinutes"), den: 1 };

  // After session feelings: E09 is the share felt energised or okay, E10 the mean focus from 1 to 5.
  const felt = [...rowsOf(events, "hour.felt"), ...rowsOf(events, "desk.felt")];
  if (felt.length > 0) {
    out.E09 = { num: felt.filter((e) => OKAY_FEELS.includes(String(e.payload.feel))).length, den: felt.length };
    out.E10 = { num: sumOf(felt, "focus"), den: felt.length };
  }

  // Meals: presence, the groups and the times of the plates. Never an amount, and never a total of anything eaten.
  const meals = rowsOf(events, "meals.logged");
  if (meals.length > 0) {
    out.H01 = { num: meals.some((e) => e.payload.meal === "breakfast" && houseHour(e.occurredAt) < 11) ? 1 : 0, den: 1 };
    out.H02 = { num: new Set(meals.map((e) => String(e.payload.group))).size, den: 5 };
    out.H04 = { num: meals.some((e) => e.payload.meal === "dinner" && houseHour(e.occurredAt) >= 22) ? 1 : 0, den: 1 };
    // Only plates that carry the processing tag count, so a plate logged before the tag existed is left out of both parts.
    const known = meals.filter((e) => typeof e.payload.processing === "string" && (PROCESSING as readonly string[]).includes(e.payload.processing));
    // The time of each slot (H03): the mean minute of the day's plates of that slot, on the house day's scale. The period value is the median.
    for (const [slot, metric] of Object.entries(MEAL_SLOT_METRIC)) {
      const plates = meals.filter((e) => e.payload.meal === slot);
      if (plates.length > 0) out[metric] = { num: Math.round(plates.reduce((s, e) => s + houseMinute(e.occurredAt), 0) / plates.length), den: 1 };
    }
    if (known.length > 0) out.H05 = { num: known.filter((e) => e.payload.processing === "packaged" || e.payload.processing === "fried").length, den: known.length };
  }

  // Sleep: the bed time and the length of the night, both on the sleep room's own scale (minutes after noon, minutes slept).
  const sleep = rowsOf(events, "sleep.logged");
  if (sleep.length > 0) {
    const night = sleep[sleep.length - 1];
    out.H06 = { num: num(night.payload.bedMin), den: 1 };
    out.H07 = { num: num(night.payload.lengthMin), den: 1 };
  }

  // Papers: A01 is the papers sat over the papers that closed that day, A02 the multiple choice answers right over those tried, and A06 the hints
  // opened over the questions answered.
  const sat = rowsOf(events, "exams.submitted");
  const missed = rowsOf(events, "exams.missed");
  if (sat.length + missed.length > 0) out.A01 = { num: sat.length, den: sat.length + missed.length };
  const tried = sumOf(sat, "mcqTried");
  if (tried > 0) out.A02 = { num: sumOf(sat, "mcqRight"), den: tried };
  const answered = tried + sumOf(sat, "longDone");
  if (answered > 0) out.A06 = { num: sumOf(sat, "hints"), den: answered };

  // Modules: films kept that day (a count), and a post a teacher published (E11).
  const kept = rowsOf(events, "modules.kept");
  if (kept.length > 0) out.A15 = { num: kept.length, den: 1 };
  const posts = rowsOf(events, "blog.published");
  if (posts.length > 0) {
    out.E11 = { num: 1, den: 1 };
    // The length of a post (E12), its range of words (E13, the moving type-token ratio in thousandths, only for a post of 50 words or more), whether it
    // has a list or paragraphs (E14) and what it is about (E15). A day's value is over the day's posts; a period's is the median or the sum of tops.
    out.E12 = { num: Math.round(sumOf(posts, "words") / posts.length), den: 1 };
    const ranged = posts.filter((e) => typeof e.payload.ttr === "number");
    if (ranged.length > 0) out.E13 = { num: Math.round(sumOf(ranged, "ttr") / ranged.length), den: 1 };
    out.E14 = { num: posts.filter((e) => e.payload.list === true || e.payload.paragraphs === true).length, den: posts.length };
    out.E15S = { num: posts.filter((e) => e.payload.tag === "study").length, den: posts.length };
    out.E15R = { num: posts.filter((e) => e.payload.tag === "reflection").length, den: posts.length };
    out.E15Q = { num: posts.filter((e) => e.payload.tag === "question").length, den: posts.length };
    out.E15I = { num: posts.filter((e) => e.payload.tag === "idea").length, den: posts.length };
  }
  // Comments written (E16, the student's own doing) and comments received on their posts (E16R, a teacher's approval, so not a log).
  const written = rowsOf(events, "blog.commented").length;
  if (written > 0) out.E16 = { num: written, den: 1 };
  const received = rowsOf(events, "blog.replied").length;
  if (received > 0) out.E16R = { num: received, den: 1 };

  // ---- Version 9 (house spec 0030) ----
  // Stress level (E04): a stressed or heavy day over the mood days. When stress shows (E07): on such a day, the one context it falls in, in this order: a
  // paper due the next day, three or more study hours that day, anything else.
  if (moods.length > 0) {
    const mood = String(moods[moods.length - 1].payload.mood);
    const low = STRESSED_MOODS.includes(mood) || HEAVY_MOODS.includes(mood);
    out.E04 = { num: low ? 1 : 0, den: 1 };
    if (low) {
      const studied = sumOf(present, "minutes") + sumOf(atDesk, "minutes");
      const context = facts.paperDueNext === true ? "P" : studied >= STUDY_HOURS_MINUTES ? "T" : "O";
      out.E07P = { num: context === "P" ? 1 : 0, den: 1 };
      out.E07T = { num: context === "T" ? 1 : 0, den: 1 };
      out.E07O = { num: context === "O" ? 1 : 0, den: 1 };
    }
  }
  // Why answers went wrong (A07: misread, careless, concept over the wrong answers), answer pace (A08: seconds per timed answer) and the paper gain (A20).
  const wrong = sumOf(sat, "wrongMisread") + sumOf(sat, "wrongCareless") + sumOf(sat, "wrongConcept");
  if (wrong > 0) {
    out.A07M = { num: sumOf(sat, "wrongMisread"), den: wrong };
    out.A07C = { num: sumOf(sat, "wrongCareless"), den: wrong };
    out.A07K = { num: sumOf(sat, "wrongConcept"), den: wrong };
  }
  const timed = sumOf(sat, "paceN");
  if (timed > 0) out.A08 = { num: sumOf(sat, "paceSec"), den: timed };
  const gained = sat.filter((e) => typeof e.payload.gain === "number");
  if (gained.length > 0) out.A20 = { num: num(gained[gained.length - 1].payload.gain), den: 1 };
  // The teacher's rubric on written answers (A03): the mean of every score given, each 0 to 4.
  const remarks = rowsOf(events, "exams.remarked");
  if (sumOf(remarks, "rubricN") > 0) out.A03 = { num: sumOf(remarks, "rubricSum"), den: sumOf(remarks, "rubricN") };
  // Asked for help (E17): a counseling booking made. A count, never a trend or a score.
  const asked = rowsOf(events, "counsel.asked").length;
  if (asked > 0) out.E17 = { num: asked, den: 1 };
  // Habit feels (H10): the weekly four answers, each 1 to 7, as a mean.
  const rated = rowsOf(events, "habits.rated");
  if (rated.length > 0) out.H10 = { num: sumOf(rated, "score"), den: rated.length * 4 };
  // The film checks (A16): answers right over asked.
  const checked = rowsOf(events, "modules.checked");
  if (sumOf(checked, "asked") > 0) out.A16 = { num: sumOf(checked, "right"), den: sumOf(checked, "asked") };
  // Help given (A19): a comment the post's author marked helpful.
  const helped = rowsOf(events, "blog.helped").length;
  if (helped > 0) out.A19 = { num: helped, den: 1 };
  // Doubts resolved (A18): answers the student marked as solving it, over the questions of the day's sittings (never more than the questions).
  const doubts = sumOf(sittings, "doubts");
  if (doubts > 0) out.A18 = { num: Math.min(rowsOf(events, "desk.resolved").length, doubts), den: doubts };
  // The desk's practice (Desk Design D3): recall after 7 days (A04), old mistakes now right (A05), recall rounds (A13), topics newly held (A09).
  const answers = rowsOf(events, "desk.answered");
  const rightOf = (rows: readonly EventRow[]): Value | undefined => (rows.length > 0 ? { num: rows.filter((e) => e.payload.right === true).length, den: rows.length } : undefined);
  const a04 = rightOf(answers.filter((e) => e.payload.seen7 === true));
  if (a04) out.A04 = a04;
  const a05 = rightOf(answers.filter((e) => e.payload.pastWrong === true));
  if (a05) out.A05 = a05;
  const a13 = rightOf(answers.filter((e) => e.payload.mode === "recall"));
  if (a13) out.A13 = a13;
  const held = rowsOf(events, "desk.mastered").length;
  if (held > 0) out.A09 = { num: held, den: 1 };

  // Showing up: any room event at all, except what the system or a teacher writes and the student did not do (a paper that closed unsat, a comment
  // received). C02 is how many rooms had a log that day.
  const own = events.filter((e) => !NOT_THE_STUDENTS.includes(e.type));
  if (own.length > 0) {
    out.C01 = { num: 1, den: 1 };
    out.C02 = { num: new Set(own.map((e) => e.type.split(".")[0])).size, den: 1 };
  }
  return out;
}

// ---- Tagged values (house spec 0028) ----------------------------------------------------------------------------------------------------------

// A day's values that carry a tag, for the connections P4 and P6 only, kept apart from the measures so no lamp, chain, coverage or parent page reads
// them. `p:<topic id>`: the multiple choice answers right over those tried on a topic. `d:<topic id>`: a desk sitting on a topic (the student's tap).
// `s:<subject>`: of the after session cards in a subject (desk and study hour), how many were drained. Ids and codes only, never a word.
export type DayTags = Record<string, Value>;
export const DRAINED = "drained";

export function tagsOfDay(events: readonly EventRow[]): DayTags {
  const out: DayTags = {};
  const add = (key: string, n: number, d: number) => {
    const t = out[key] ?? { num: 0, den: 0 };
    out[key] = { num: t.num + n, den: t.den + d };
  };
  for (const e of rowsOf(events, "exams.submitted")) {
    const topics = e.payload.topics;
    const tried = e.payload.topicTried;
    const right = e.payload.topicRight;
    if (!Array.isArray(topics) || !Array.isArray(tried) || !Array.isArray(right)) continue;
    topics.forEach((id, i) => {
      if (typeof id === "string" && num(tried[i]) > 0) add(`p:${id}`, num(right[i]), num(tried[i]));
    });
  }
  for (const e of rowsOf(events, "desk.felt")) {
    if (typeof e.payload.topic === "string") out[`d:${e.payload.topic}`] = { num: 1, den: 1 };
  }
  for (const e of [...rowsOf(events, "desk.felt"), ...rowsOf(events, "hour.felt")]) {
    if (typeof e.payload.subject === "string") add(`s:${e.payload.subject}`, e.payload.feel === DRAINED ? 1 : 0, 1);
  }
  // Version 9 (house spec 0030). `q:<topic id>`: desk practice answers right of asked on a topic (A14). `m:<subject>`: the minutes of a desk sitting the
  // student gave a subject (A11). `f:<topic id>`: a film's checks answered on its topic (A17).
  for (const e of rowsOf(events, "desk.answered")) {
    if (typeof e.payload.topic === "string") add(`q:${e.payload.topic}`, e.payload.right === true ? 1 : 0, 1);
  }
  for (const e of rowsOf(events, "desk.felt")) {
    if (typeof e.payload.subject === "string" && typeof e.payload.minutes === "number") add(`m:${e.payload.subject}`, num(e.payload.minutes), 1);
  }
  for (const e of rowsOf(events, "modules.checked")) {
    if (typeof e.payload.topic === "string") add(`f:${e.payload.topic}`, 1, 1);
  }
  return out;
}

// ---- Periods ------------------------------------------------------------------------------------------------------------------------------

export type DayRow = { day: string; v: DayValues; t?: DayTags };

// The sum of one measure over some days: the tops, the bottoms and how many days carried a value (`logged`, printed beside every period value).
export function periodOf(rows: readonly DayRow[], metric: MetricId): { num: number; den: number; logged: number } {
  let n = 0;
  let d = 0;
  let logged = 0;
  for (const row of rows) {
    const value = row.v[metric];
    if (value === undefined) continue;
    n += value.num;
    d += value.den;
    logged += 1;
  }
  return { num: n, den: d, logged };
}

// A share from 0 to 1, or null when no day carried a value: a week with nothing logged has no value, and is never 0.
export function shareOf(rows: readonly DayRow[], metric: MetricId): number | null {
  const p = periodOf(rows, metric);
  return p.den > 0 ? p.num / p.den : null;
}

// The median of the days' tops for a clock or length measure (bed time, sleep length, study minutes), or null with nothing logged.
export function medianOf(rows: readonly DayRow[], metric: MetricId): number | null {
  const values = rows.flatMap((r) => (r.v[metric] === undefined ? [] : [r.v[metric].num])).sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor((values.length - 1) / 2);
  return values.length % 2 === 1 ? values[mid] : (values[mid] + values[mid + 1]) / 2;
}

// ---- Period measures (house spec 0030) ----------------------------------------------------------------------------------------------------

const DAY_LENGTH_MS = 24 * 60 * 60 * 1000;
const dayShift = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_LENGTH_MS).toISOString().slice(0, 10);

// The forgiving streak (H09): days in a row with a log of the student's own, where one missed day in any seven is forgiven. Today counts once it has a log
// and is never a miss while it has none. `current` ends at today; `longest` is the longest in the rows given. Both count the logged days.
export function forgivingStreakOf(rows: readonly DayRow[], today: string): { current: number; longest: number } {
  const logged = new Set(rows.filter((r) => loggedOn(r.v)).map((r) => r.day));
  if (logged.size === 0) return { current: 0, longest: 0 };
  let longest = 0;
  let run = 0;
  let lastMiss: string | null = null;
  for (let day = [...logged].sort()[0]; day <= today; day = dayShift(day, 1)) {
    if (logged.has(day)) {
      run += 1;
    } else if (day !== today) {
      if (lastMiss !== null && lastMiss > dayShift(day, -7)) {
        run = 0;
        lastMiss = null;
      } else {
        lastMiss = day;
      }
    }
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}

// Desk time by subject (A11): of all the desk minutes in the rows (X02), the share each subject the student gave a sitting holds.
export function deskTimeBySubject(rows: readonly DayRow[]): { subject: string; share: number; minutes: number }[] {
  const all = periodOf(rows, "X02").num;
  if (all <= 0) return [];
  const by = new Map<string, number>();
  for (const r of rows) {
    for (const [key, value] of Object.entries(r.t ?? {})) if (key.startsWith("m:")) by.set(key.slice(2), (by.get(key.slice(2)) ?? 0) + value.num);
  }
  return [...by.entries()]
    .filter(([, m]) => m > 0)
    .map(([subject, minutes]) => ({ subject, minutes, share: Math.min(1, minutes / all) }))
    .sort((a, b) => b.minutes - a.minutes);
}

// The film's effect on papers (A17): for each topic whose film checks were answered, the share right on that topic's paper answers in the 7 days before and
// in the 7 days after, only with 4 or more answers on each side (Master Spec).
export const EFFECT_MIN_ITEMS = 4;
export function filmEffectOf(rows: readonly DayRow[]): { topic: string; before: number; after: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { topic: string; before: number; after: number }[] = [];
  for (const r of rows) {
    for (const key of Object.keys(r.t ?? {})) {
      if (!key.startsWith("f:")) continue;
      const topic = key.slice(2);
      const side = (from: number, to: number) => {
        let n = 0;
        let d = 0;
        for (let i = from; i <= to; i += 1) {
          const value = byDay.get(dayShift(r.day, i))?.t?.[`p:${topic}`];
          if (value) {
            n += value.num;
            d += value.den;
          }
        }
        return { n, d };
      };
      const before = side(-7, -1);
      const after = side(1, 7);
      if (before.d >= EFFECT_MIN_ITEMS && after.d >= EFFECT_MIN_ITEMS) out.push({ topic, before: before.n / before.d, after: after.n / after.d });
    }
  }
  return out;
}

// The weak topic follow up (A14): of the topics the student got wrong on a paper, how many they studied on the desk (practice, or a sitting they tapped the
// topic for) the same day or in the 3 days after. A wrong topic whose 3 days are not over counts only once it has been studied.
export const FOLLOW_UP_DAYS = 3;
export function weakFollowUpOf(rows: readonly DayRow[], today: string): { studied: number; wrong: number } {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  let studied = 0;
  let wrong = 0;
  for (const r of rows) {
    for (const [key, value] of Object.entries(r.t ?? {})) {
      if (!key.startsWith("p:") || value.num >= value.den) continue;
      const topic = key.slice(2);
      let done = false;
      for (let i = 0; i <= FOLLOW_UP_DAYS && !done; i += 1) {
        const t = byDay.get(dayShift(r.day, i))?.t;
        if (t && (t[`q:${topic}`] !== undefined || t[`d:${topic}`] !== undefined)) done = true;
      }
      if (done) {
        studied += 1;
        wrong += 1;
      } else if (dayShift(r.day, FOLLOW_UP_DAYS) < today) {
        wrong += 1;
      }
    }
  }
  return { studied, wrong };
}

// Everything the Progress page shows of the version 9 measures (house spec 0030), over the rows given: `recent` the last 28 days with today, `long` the
// last 120. Shares are tops and bottoms, never a percentage of percentages; a measure with nothing behind it is null or zero, never a made up value.
export type Pair = { num: number; den: number };
export function measuresOf(recent: readonly DayRow[], long: readonly DayRow[], today: string) {
  const pair = (metric: MetricId): Pair => {
    const p = periodOf(recent, metric);
    return { num: p.num, den: p.den };
  };
  const mean = (metric: MetricId): number | null => {
    const p = periodOf(recent, metric);
    return p.den > 0 ? p.num / p.den : null;
  };
  const gains = recent.filter((r) => r.v.A20 !== undefined);
  return {
    stress: stressBandOf(shareOf(recent, "E04")),
    stressDays: periodOf(recent, "E04").logged,
    stressWhen: { paper: periodOf(recent, "E07P").num, hours: periodOf(recent, "E07T").num, other: periodOf(recent, "E07O").num },
    streak: forgivingStreakOf(long, today),
    pace: mean("A08"),
    paceAnswers: periodOf(recent, "A08").den,
    deskBySubject: deskTimeBySubject(recent).map((d) => ({ subject: d.subject, share: d.share })),
    wrongWhy: { misread: periodOf(recent, "A07M").num, careless: periodOf(recent, "A07C").num, concept: periodOf(recent, "A07K").num },
    paperGain: gains.length > 0 ? gains[gains.length - 1].v.A20!.num : null,
    helpAsked: periodOf(recent, "E17").num,
    understanding: mean("A03"),
    habitFeel: mean("H10"),
    filmCheck: pair("A16"),
    filmEffect: filmEffectOf(long),
    helpGiven: periodOf(recent, "A19").num,
    doubts: pair("A18"),
    recall7: pair("A04"),
    oldMistakes: pair("A05"),
    recallRounds: pair("A13"),
    held: periodOf(recent, "A09").num,
    weakFollowUp: weakFollowUpOf(long, today),
  };
}
