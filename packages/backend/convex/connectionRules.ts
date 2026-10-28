// The connections engine (spec house/0023; the Master Spec's "Connections engine"). Cross room patterns in ONE student's own days, tested on a fixed list
// of pairs so the engine cannot go fishing for coincidences. For each pair the student's finished days fall into group A, group B or neither by a fixed
// cut point (never tuned for a student), and one outcome is compared between the groups. A connection is shown only if each group has 14 or more days,
// the 95 percent bootstrap interval of the difference of the means leaves out 0, and it survives a Benjamini Hochberg correction over all the pairs at
// q below 0.1. The tests use a seeded generator, so the same days always give the same answer and a connection never flickers between two looks.
//
// Built here: P1 (sleep and paper accuracy), P2 (breakfast and focus), P3 (bedtime and mood), P5 (late study room and the next day's feeling), and
// from house spec 0028 (owner, 2026-10-28) P4 (a desk sitting on a topic and the next day's paper answers on that topic) and P6 (the sessions of one
// subject and how often they left the student drained), which read the day's tagged values (`DayTags`). A connection is the student's alone, like the
// rest of the Brain: no staff function reads it. No clock and no database: the caller passes the days.
import type { ConnectionId } from "./brainCodes";
import { shiftDay } from "./dayRules";
import { SUBJECTS } from "./sessionRules";
import type { DayRow, DayTags, DayValues, MetricId, Value } from "./metricRules";

export const CONNECTION_MIN_DAYS = 14; // days in each group before two groups are compared
export const CONNECTION_MIN_SESSIONS = 10; // P6 compares sessions, not days: 10 or more on each side (the Master Spec)
export const CONNECTION_RESAMPLES = 2000; // bootstrap resamples for the interval, and shuffles for the p value
export const CONNECTION_Q = 0.1; // the false discovery rate of the Benjamini Hochberg step
export const CONNECTION_PAIRS = 6; // the Master Spec's list; the pairs that cannot be tested yet count with p = 1
export const BED_CUT = 690; // 23:30 on the noon scale of the sleep room (minutes after 12:00)
export const BREAKFAST_CUT = 660; // 11:00 on the house day's minute scale (minutes after midnight)
export const LATE_MINUTES = 30; // minutes in the study room after 23:00 for a late day

type Sample = { group: "a" | "b"; y: number };
export type ConnectionHit = { id: ConnectionId; a: number; b: number; nA: number; nB: number; subject?: string };

const ratioOf = (v: Value | undefined): number | null => (v && v.den > 0 ? v.num / v.den : null);
const has = (v: DayValues, ...ids: MetricId[]): boolean => ids.some((id) => v[id] !== undefined);

// The samples of each pair from the finished days (those before today). A day the pair's rule does not name is in neither group.
function samplesOf(id: ConnectionId, days: ReadonlyMap<string, DayValues>, finished: readonly string[]): Sample[] {
  const out: Sample[] = [];
  for (const day of finished) {
    const v = days.get(day);
    if (!v) continue;
    if (id === "sleep_papers") {
      const bed = v.H06?.num;
      const y = ratioOf(v.A02);
      if (bed !== undefined && y !== null) out.push({ group: bed < BED_CUT ? "a" : "b", y });
    } else if (id === "breakfast_focus") {
      const y = ratioOf(v.E10);
      if (y === null) continue;
      const breakfast = v.H03B?.num;
      if (breakfast !== undefined) {
        if (breakfast < BREAKFAST_CUT) out.push({ group: "a", y });
      } else if (has(v, "H01", "H02", "H03L", "H03S", "H03D")) {
        out.push({ group: "b", y });
      }
    } else if (id === "bedtime_mood") {
      const bed = v.H06?.num;
      if (bed !== undefined && has(v, "E06L", "E06S", "E06H")) out.push({ group: bed < BED_CUT ? "a" : "b", y: v.E06L?.num === 1 ? 1 : 0 }); // a mood day holds all three bands, the chosen one at 1 (review of 2026-10-26)
    } else {
      // late_room_feeling: a study room day by how late it ran, and the feeling the next day.
      const late = v.H11?.num;
      const next = days.get(shiftDay(day, 1));
      const y = ratioOf(next?.E09);
      if (late === undefined || y === null || !finished.includes(shiftDay(day, 1))) continue;
      if (late >= LATE_MINUTES) out.push({ group: "a", y });
      else if (late === 0) out.push({ group: "b", y });
    }
  }
  return out;
}

// P4: each finished day with paper answers on a topic is one sample for that topic, its share right. It is group A when the day before held a desk
// sitting the student tagged with that topic, and group B when it did not. Topics are matched by their id only.
function topicSamples(tags: ReadonlyMap<string, DayTags>, finished: readonly string[]): Sample[] {
  const out: Sample[] = [];
  for (const day of finished) {
    const t = tags.get(day);
    if (!t) continue;
    const before = tags.get(shiftDay(day, -1));
    for (const [key, value] of Object.entries(t)) {
      if (!key.startsWith("p:") || value.den <= 0) continue;
      out.push({ group: before?.[`d:${key.slice(2)}`] !== undefined ? "a" : "b", y: value.num / value.den });
    }
  }
  return out;
}

type Tested = { id: ConnectionId; a: number[]; b: number[]; test: ReturnType<typeof compare>; subject?: string };

// P6: every tagged session of the finished days, as its subject and 1 when it was drained. One test for each subject against all the others; the
// subject whose test is strongest stands for the pair, with its p value multiplied by the subjects tested (Bonferroni), so trying six subjects never
// makes a coincidence easier to show.
function subjectTest(tags: ReadonlyMap<string, DayTags>, finished: readonly string[]): Tested | null {
  const sessions: { subject: string; y: number }[] = [];
  for (const day of finished) {
    const t = tags.get(day);
    if (!t) continue;
    for (const s of SUBJECTS) {
      const value = t[`s:${s}`];
      if (!value) continue;
      for (let i = 0; i < value.den; i += 1) sessions.push({ subject: s, y: i < value.num ? 1 : 0 });
    }
  }
  const tests: Tested[] = [];
  for (const s of SUBJECTS) {
    const a = sessions.filter((x) => x.subject === s).map((x) => x.y);
    const b = sessions.filter((x) => x.subject !== s).map((x) => x.y);
    if (a.length < CONNECTION_MIN_SESSIONS || b.length < CONNECTION_MIN_SESSIONS) continue;
    tests.push({ id: "subject_feeling", subject: s, a, b, test: compare(`subject_feeling:${s}`, a, b) });
  }
  if (tests.length === 0) return null;
  const best = tests.reduce((x, y) => (y.test.p < x.test.p ? y : x));
  return { ...best, test: { ...best.test, p: Math.min(1, best.test.p * tests.length) } };
}

// ---- The statistics ------------------------------------------------------------------------------------------------------------------------

// A small seeded generator (mulberry32), so the resamples are the same every time for the same days.
function generator(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (id: string, xs: readonly number[]): number => {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  for (const x of xs) h = Math.imul(h ^ Math.round(x * 1000), 16777619);
  return h >>> 0;
};
const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

// The difference of the means (A minus B), the 95 percent bootstrap interval of it, and a two sided shuffle p value.
export function compare(id: string, a: readonly number[], b: readonly number[]): { diff: number; lo: number; hi: number; p: number } {
  const diff = mean(a) - mean(b);
  const rand = generator(seedOf(id, [...a, ...b]));
  const pick = (xs: readonly number[]): number => xs[Math.floor(rand() * xs.length)];
  const diffs: number[] = [];
  for (let i = 0; i < CONNECTION_RESAMPLES; i += 1) {
    let sa = 0;
    let sb = 0;
    for (let j = 0; j < a.length; j += 1) sa += pick(a);
    for (let j = 0; j < b.length; j += 1) sb += pick(b);
    diffs.push(sa / a.length - sb / b.length);
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor(0.025 * CONNECTION_RESAMPLES)];
  const hi = diffs[Math.ceil(0.975 * CONNECTION_RESAMPLES) - 1];
  const pool = [...a, ...b];
  let atLeast = 0;
  for (let i = 0; i < CONNECTION_RESAMPLES; i += 1) {
    for (let j = pool.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rand() * (j + 1));
      [pool[j], pool[k]] = [pool[k], pool[j]];
    }
    const d = mean(pool.slice(0, a.length)) - mean(pool.slice(a.length));
    if (Math.abs(d) >= Math.abs(diff) - 1e-12) atLeast += 1;
  }
  return { diff, lo, hi, p: (atLeast + 1) / (CONNECTION_RESAMPLES + 1) };
}

// The Benjamini Hochberg step: of `m` pairs, the ones whose p value is within the largest rank k with p(k) <= k / m * q. Untested pairs have p = 1.
export function survivors(ps: ReadonlyMap<string, number>, m: number, q: number): Set<string> {
  const ranked = [...ps.entries()].sort((x, y) => x[1] - y[1]);
  let k = 0;
  ranked.forEach(([, p], i) => {
    if (p <= ((i + 1) / m) * q) k = i + 1;
  });
  return new Set(ranked.slice(0, k).map(([id]) => id));
}

// What is shown for each outcome: a share as a whole percent, the focus as a mean out of 5 with one decimal.
const display = (id: ConnectionId, x: number): number => (id === "breakfast_focus" ? Math.round(x * 10) / 10 : Math.round(x * 100));

export const CONNECTION_PAIR_IDS: readonly ConnectionId[] = ["sleep_papers", "breakfast_focus", "bedtime_mood", "late_room_feeling", "topic_desk_papers", "subject_feeling"];

// The connections that stand for this student, from all their days. `today` is not read: only the days before it are finished.
export function connectionsOf(rows: readonly DayRow[], today: string): ConnectionHit[] {
  const days = new Map(rows.map((r) => [r.day, r.v] as const));
  const tags = new Map(rows.flatMap((r) => (r.t ? [[r.day, r.t] as const] : [])));
  const finished = rows.map((r) => r.day).filter((d) => d < today);
  const tested: Tested[] = [];
  for (const id of CONNECTION_PAIR_IDS) {
    if (id === "subject_feeling") {
      const t = subjectTest(tags, finished);
      if (t) tested.push(t);
      continue;
    }
    const samples = id === "topic_desk_papers" ? topicSamples(tags, finished) : samplesOf(id, days, finished);
    const a = samples.filter((s) => s.group === "a").map((s) => s.y);
    const b = samples.filter((s) => s.group === "b").map((s) => s.y);
    if (a.length < CONNECTION_MIN_DAYS || b.length < CONNECTION_MIN_DAYS) continue;
    tested.push({ id, a, b, test: compare(id, a, b) });
  }
  const passing = survivors(new Map(tested.map((t) => [t.id as string, t.test.p])), CONNECTION_PAIRS, CONNECTION_Q);
  const hits: ConnectionHit[] = [];
  for (const t of tested) {
    if (!passing.has(t.id)) continue;
    if (t.test.lo <= 0 && t.test.hi >= 0) continue; // the interval must leave out 0
    // The food guard: nothing is shown that would suggest eating less, or skipping a meal, goes with a better outcome.
    if (t.id === "breakfast_focus" && t.test.diff < 0) continue;
    hits.push({ id: t.id, a: display(t.id, mean(t.a)), b: display(t.id, mean(t.b)), nA: t.a.length, nB: t.b.length, ...(t.subject ? { subject: t.subject } : {}) });
  }
  return hits;
}
