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
export const METRIC_VERSION = 6;

// E06 is the mood mix, one measure for each family of moods; E15 the tags of the posts, one for each tag; H03 the meal times, one for each slot. The Master
// Spec keeps these as breakdowns of one id; here each key is its own id so a day stays one top and one bottom for each id.
export const METRIC_IDS = [
  "A01", "A02", "A06", "A10", "A12", "A15",
  "C01", "C02",
  "E01", "E02", "E03", "E05", "E06L", "E06S", "E06H", "E08", "E09", "E10", "E11", "E12", "E13", "E14", "E15S", "E15R", "E15Q", "E15I", "E16", "E16R",
  "H01", "H02", "H03B", "H03L", "H03S", "H03D", "H04", "H05", "H06", "H07", "H08", "H11", "H12",
  "X01", "X02",
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
};

// Whether a day's value means the student did something. A zero of a thing that was expected and did not happen (a habit open and not ticked, a study
// hour open and not sat, a paper that closed unsat) is a real zero for the lamps, but it is not a log: a student who logged nothing has no logged days,
// and no chain may count a day that holds only such zeros. C01 is derived from the others and is not a log of its own.
export function didSomething(metric: MetricId, value: Value): boolean {
  if (metric === "C01" || metric === "C02" || metric === "E16R" || metric === "X02" || metric === "A10" || metric === "A12") return false;
  if (metric === "H08" || metric === "H12" || metric === "X01" || metric === "A01") return value.num > 0;
  return true;
}
export const loggedOn = (values: DayValues): boolean => (Object.entries(values) as [MetricId, Value][]).some(([metric, value]) => didSomething(metric, value));

// The events a day is made from: the type, the payload and the time it happened. Only the current, not voided events of the day are given.
export type EventRow = { type: string; payload: Record<string, unknown>; occurredAt: number };

// The facts about the day that the events cannot say. A thing that was expected and did not happen is a zero only when the day is over.
export type DayFacts = {
  openHabits: number; // habits open on the day (their plan windows)
  hourOpen: boolean; // a study hour was open on the day
  finished: boolean; // the house day is over
  prevLightness?: number | undefined; // the lightness (1 to 5) of the mood on the student's previous logged day, for the mood swing
};

// Events the student did not do: the system closes a paper unsat, and a teacher's approval brings a comment to the author of the post.
const NOT_THE_STUDENTS: readonly string[] = ["exams.missed", "blog.replied"];
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

  // Showing up: any room event at all, except what the system or a teacher writes and the student did not do (a paper that closed unsat, a comment
  // received). C02 is how many rooms had a log that day.
  const own = events.filter((e) => !NOT_THE_STUDENTS.includes(e.type));
  if (own.length > 0) {
    out.C01 = { num: 1, den: 1 };
    out.C02 = { num: new Set(own.map((e) => e.type.split(".")[0])).size, den: 1 };
  }
  return out;
}

// ---- Periods ------------------------------------------------------------------------------------------------------------------------------

export type DayRow = { day: string; v: DayValues };

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
