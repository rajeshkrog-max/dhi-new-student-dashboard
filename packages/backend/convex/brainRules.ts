// The pure rules of the Brain's patterns, lamps and notes (spec house/0020, scope rows 18 to 21; the Master Spec's insight rules). No database and no
// clock: the caller passes the student's daily values (metricRules.ts DayRow) and the house day it is today. Every rule is fixed, every threshold
// is a named constant below, and the same days always give the same answer. Nothing here ranks or labels a student, compares two students or
// writes a sentence: a hit is an id, a few counts and the days and measures behind it, and the words are the screen's (src/lib/dhi/brain-words.ts).
//
// What a chain is: a few things in the student's OWN last 14 days that came together, tested against that student's other days so a student who is
// quiet every day does not trigger it. A day with no log is never a zero: only a thing that was expected and did not happen (a habit that was open,
// a study hour that was open, a paper that closed) counts as quiet, and only once the day is over.
import { CHAIN_DAYS, CONNECTION_IDS, EVIDENCE_ITEMS, HIDE_DAYS, MIN_LOGGED_DAYS, PATTERN_IDS, type EvidenceItem, type Movement, type PatternId } from "./brainCodes";
import { shiftDay } from "./dayRules";
import { LAMPS, lampValue, ratio, scoreOf, type Lamp } from "./homeRules";
import { didSomething, loggedOn, periodOf, type DayRow, type DayValues, type MetricId } from "./metricRules";

// The codes both sides name live in brainCodes.ts; they are re-exported here so the server reads them from one place.
export { CHAIN_DAYS, EVIDENCE_ITEMS, HIDE_DAYS, MIN_LOGGED_DAYS, PATTERN_IDS };
export type { EvidenceItem, Movement, PatternId };

// ---- Gates the owner closes (spec house/0020) ---------------------------------------------------------------------------------------------
// The research behind each pattern was found by search and is indirect (docs/specs/house/0020-brain-patterns-lamps-and-report/sources.md). Until the
// DHI team has read and confirmed it, every hit is shown as a draft. A pattern whose source the team rejects is removed from PATTERN_IDS.
export const PATTERN_SOURCES_CONFIRMED = false;
// The meals chain relates what a student ate to how their next day went. For students under 18 it stays off until the owner says yes.
export const FOOD_PATTERN_ON = false;

// ---- Thresholds ----------------------------------------------------------------------------------------------------------------------------
// CHAIN_DAYS (14 finished days a chain reads), MIN_LOGGED_DAYS (5 days with any value before DHI says anything) and HIDE_DAYS (30) are in brainCodes.ts.
export const CLUSTER_SPAN = 7; // low mood days count as clustered when this many days hold enough of them
export const MIN_LOW_DAYS = 3;
export const MIN_CHAIN_DAYS = 2; // days where every link of the chain holds
export const MIN_EXPECTED_NEXT = 3; // next days where something was expected, in each group, before two groups are compared
export const MIN_CONTRAST = 0.3; // the share of quiet next days must be this much higher than on the student's other days
export const MIN_HEAVY_MEAL_DAYS = 4;
export const HEAVY_SHARE = 0.5; // a day is packaged or fried heavy when half or more of its tagged items are
export const MIN_TAGGED_ITEMS = 2;
export const RHYTHM_HOUR_DAYS = 4; // days sat in the study hour
export const RHYTHM_HOUR_SHARE = 0.6; // of the days an hour was open
export const RHYTHM_HABIT_DAYS = 8; // days a habit was open
export const RHYTHM_HABIT_SHARE = 0.7; // of them with a tick
export const RHYTHM_MIN_PAPERS = 2; // papers closed in the last 28 days, all of them sat
export const PAPER_DAYS = 28;
export const RUN_MIN = 2; // consecutive low mood days that make a run
export const POST_WITHIN_DAYS = 7; // a post published this soon after a run is noted
export const SUPPORT_WEEK = 7;
export const SUPPORT_LOW_DAYS = 3; // low mood days in the last week
export const SUPPORT_OPEN_DAYS = 5; // days a habit was open, in each of the two weeks
export const SUPPORT_HABIT_DROP = 0.3; // fall in the share of open days ticked
export const SUPPORT_MEAL_PREV = 3; // days with a plate logged the week before
export const SUPPORT_MEAL_DROP = 2; // fewer such days than the week before
export const LAMP_WINDOW = 28;
export const VIVEKA_FULL = 4; // films kept in the window that fill the Viveka lamp. Films are optional, so films DHI added and a student has not watched never lower it.
export const MOVE_WINDOW = 14;
export const MOVE_MIN_DAYS = 3; // logged days a lamp needs in each half before its movement is said
export const CLEAR_RISE = 0.1; // a lamp moves when it changes by this much of its 0 to 1 scale

// ---- Patterns --------------------------------------------------------------------------------------------------------------------------------
export const isPatternId = (text: unknown): text is PatternId => typeof text === "string" && (PATTERN_IDS as readonly string[]).includes(text);
// The ids a student may hide: the three patterns and the expression note.
export const HIDEABLE_IDS = [...PATTERN_IDS, ...CONNECTION_IDS, "expression"] as const;
export const isHideable = (text: unknown): text is (typeof HIDEABLE_IDS)[number] => typeof text === "string" && (HIDEABLE_IDS as readonly string[]).includes(text);

// What each pattern is made of. `kind` splits supporting from dragging so they are never mixed. `uses` lists the measures it reads: the food guard
// (below) keeps a supporting pattern away from the meal measures, and a test holds the list to what the rules really read.
export const PATTERN_META: Readonly<Record<PatternId, { kind: "supporting" | "dragging"; uses: readonly MetricId[]; source: string }>> = {
  mood_habits_quiet: { kind: "dragging", uses: ["E03", "H08", "X01", "A01"], source: "mood_activity" },
  steady_rhythm: { kind: "supporting", uses: ["H12", "H08", "A01"], source: "study_routine" },
  packaged_quiet: { kind: "dragging", uses: ["H05", "X01", "A01"], source: "processed_food" },
};

export const FOOD_MEASURES: readonly MetricId[] = ["H01", "H02", "H04", "H05"];
// The food guard (Master Spec): a pattern is never shown if it would suggest that eating less, skipping a meal or fewer food groups goes with a
// better result. So a supporting pattern may not read a meal measure at all, a meal measure may appear only as the packaged or fried share of a
// dragging pattern, and the number of food groups (H02) and the meal times (H01, H04) are never part of a pattern.
export function foodGuardOk(meta: { kind: "supporting" | "dragging"; uses: readonly MetricId[] }): boolean {
  const food = meta.uses.filter((m) => FOOD_MEASURES.includes(m));
  if (food.length === 0) return true;
  return meta.kind === "dragging" && food.every((m) => m === "H05");
}

export type Evidence = { day: string; items: EvidenceItem[] };
// The room each evidence item opens, as the ids the house menu uses.
export const EVIDENCE_ROOM: Readonly<Record<EvidenceItem, string>> = {
  low_mood: "mood",
  habit_not_ticked: "habits",
  habit_ticked: "habits",
  hour_not_sat: "hour",
  hour_sat: "hour",
  paper_missed: "papers",
  paper_sat: "papers",
  packaged_heavy: "day",
  post_published: "blog",
};

export type PatternHit = { id: PatternId; kind: "supporting" | "dragging"; params: Record<string, number | string>; evidence: Evidence[] };
export type ExpressionHit = { runDays: string[]; postDay: string };
export type SupportHit = { lowDays: number; habitShare: number; prevHabitShare: number; mealDays: number; prevMealDays: number };

type DayMap = ReadonlyMap<string, DayValues>;
export const dayMapOf = (rows: readonly DayRow[]): DayMap => new Map(rows.map((r) => [r.day, r.v]));

// The finished days before today, oldest first.
export function windowDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n; i >= 1; i -= 1) out.push(shiftDay(today, -i));
  return out;
}
const nextFinished = (day: string, today: string): string | null => {
  const next = shiftDay(day, 1);
  return next < today ? next : null;
};

// ---- Day facts -------------------------------------------------------------------------------------------------------------------------------
const isLow = (v: DayValues | undefined): boolean => v?.E03?.num === 1;
const habitNotTicked = (v: DayValues | undefined): boolean => v?.H08 !== undefined && v.H08.num === 0;
const habitTicked = (v: DayValues | undefined): boolean => v?.H08 !== undefined && v.H08.num > 0;
const hourNotSat = (v: DayValues | undefined): boolean => v?.X01 !== undefined && v.X01.num === 0;
const hourSat = (v: DayValues | undefined): boolean => v?.H12 !== undefined && v.H12.num === 1;
const paperMissed = (v: DayValues | undefined): boolean => v?.A01 !== undefined && v.A01.num < v.A01.den;
const paperSat = (v: DayValues | undefined): boolean => v?.A01 !== undefined && v.A01.num > 0;
// A quiet day is one where something was expected and did not happen: a study hour open and not sat, or a paper that closed unsat.
const quiet = (v: DayValues | undefined): boolean => hourNotSat(v) || paperMissed(v);
// Something was expected of the day: a study hour was open (or sat), or a paper closed.
const expected = (v: DayValues | undefined): boolean => v?.X01 !== undefined || v?.A01 !== undefined;
const packagedHeavy = (v: DayValues | undefined): boolean => v?.H05 !== undefined && v.H05.den >= MIN_TAGGED_ITEMS && v.H05.num / v.H05.den >= HEAVY_SHARE;

// The days among these on which the student logged something. A day that holds only a real zero (a habit open and not ticked, an hour open and not sat,
// a paper that closed unsat) is not a logged day, so a student who logged nothing has none, and a chain cannot rest on such days.
export function loggedDaysIn(map: DayMap, days: readonly string[]): number {
  return days.filter((d) => {
    const v = map.get(d);
    return v !== undefined && loggedOn(v);
  }).length;
}

// ---- The contrast ------------------------------------------------------------------------------------------------------------------------------
// How often the day after a group of days was quiet, against how often the day after the student's other days was. A chain stands only if the group's
// next days are quiet clearly more often (MIN_CONTRAST), which keeps a student who is quiet on every day from triggering it.
function quietContrast(map: DayMap, group: readonly string[], others: readonly string[], today: string): { groupQuiet: number; groupExpected: number; otherQuiet: number; otherExpected: number } | null {
  const tally = (days: readonly string[]) => {
    let seen = 0;
    let q = 0;
    for (const d of days) {
      const n = nextFinished(d, today);
      if (n === null) continue;
      const v = map.get(n);
      if (!expected(v)) continue;
      seen += 1;
      if (quiet(v)) q += 1;
    }
    return { seen, q };
  };
  const g = tally(group);
  const o = tally(others);
  if (g.seen < MIN_EXPECTED_NEXT || o.seen < MIN_EXPECTED_NEXT || g.q < MIN_CHAIN_DAYS) return null;
  if (g.q / g.seen - o.q / o.seen < MIN_CONTRAST) return null;
  return { groupQuiet: g.q, groupExpected: g.seen, otherQuiet: o.q, otherExpected: o.seen };
}

// The order the items of one day are listed in, so the same day always reads the same way.
const ITEM_ORDER: readonly EvidenceItem[] = EVIDENCE_ITEMS;

// Joins evidence entries of the same day, keeping each item once, oldest day first.
export function mergeEvidence(entries: readonly Evidence[]): Evidence[] {
  const byDay = new Map<string, EvidenceItem[]>();
  for (const e of entries) {
    const items = byDay.get(e.day) ?? [];
    for (const item of e.items) if (!items.includes(item)) items.push(item);
    byDay.set(e.day, items);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, items]) => ({ day, items: [...items].sort((a, b) => ITEM_ORDER.indexOf(a) - ITEM_ORDER.indexOf(b)) }));
}

const quietItems = (v: DayValues | undefined): EvidenceItem[] => [...(hourNotSat(v) ? (["hour_not_sat"] as const) : []), ...(paperMissed(v) ? (["paper_missed"] as const) : [])];

// ---- Pattern 1: heavy days, habits not ticked, a quieter next day (dragging) -------------------------------------------------------------------
// Fires when, in the last 14 days, at least 3 days the student marked sad or heavy fall inside one 7 day span, on at least 2 of those days a habit was
// open and not ticked and the next day was quiet, and the next days after those low days were quiet clearly more often than after the other days.
export function moodHabitsQuiet(map: DayMap, today: string): PatternHit | null {
  const days = windowDays(today, CHAIN_DAYS);
  if (loggedDaysIn(map, days) < MIN_LOGGED_DAYS) return null;
  const low = days.filter((d) => isLow(map.get(d)));
  const clustered = new Set<string>();
  for (const start of days) {
    const end = shiftDay(start, CLUSTER_SPAN - 1);
    const span = low.filter((d) => d >= start && d <= end);
    if (span.length >= MIN_LOW_DAYS) for (const d of span) clustered.add(d);
  }
  const group = [...clustered].sort();
  if (group.length < MIN_LOW_DAYS) return null;
  const chain = group.filter((d) => {
    const n = nextFinished(d, today);
    return habitNotTicked(map.get(d)) && n !== null && quiet(map.get(n));
  });
  if (chain.length < MIN_CHAIN_DAYS) return null;
  const contrast = quietContrast(
    map,
    group,
    days.filter((d) => !clustered.has(d)),
    today,
  );
  if (contrast === null) return null;
  const entries: Evidence[] = [];
  for (const d of group) {
    entries.push({ day: d, items: habitNotTicked(map.get(d)) ? ["low_mood", "habit_not_ticked"] : ["low_mood"] });
    const n = nextFinished(d, today);
    if (n !== null && chain.includes(d)) entries.push({ day: n, items: quietItems(map.get(n)) });
  }
  const evidence = mergeEvidence(entries);
  return {
    id: "mood_habits_quiet",
    kind: "dragging",
    params: { lowDays: group.length, chainDays: chain.length, window: CHAIN_DAYS, from: evidence[0].day, to: evidence[evidence.length - 1].day },
    evidence,
  };
}

// ---- Pattern 2: a steady rhythm and papers sat (supporting) -----------------------------------------------------------------------------------
// Fires when, in the last 14 days, the student sat the study hour on at least 4 days and on 60 percent or more of the days an hour was open, a habit
// was ticked on 70 percent or more of at least 8 days it was open, and every paper that closed in the last 28 days (at least 2) was sat.
export function steadyRhythm(map: DayMap, today: string): PatternHit | null {
  const days = windowDays(today, CHAIN_DAYS);
  if (loggedDaysIn(map, days) < MIN_LOGGED_DAYS) return null;
  const rowsOf = (list: readonly string[]): DayRow[] => list.flatMap((d) => (map.get(d) ? [{ day: d, v: map.get(d)! }] : []));
  const hour = periodOf(rowsOf(days), "H12");
  if (hour.num < RHYTHM_HOUR_DAYS || hour.den === 0 || hour.num / hour.den < RHYTHM_HOUR_SHARE) return null;
  const habit = periodOf(rowsOf(days), "H08");
  if (habit.den < RHYTHM_HABIT_DAYS || habit.num / habit.den < RHYTHM_HABIT_SHARE) return null;
  const paperDays = windowDays(today, PAPER_DAYS);
  const papers = periodOf(rowsOf(paperDays), "A01");
  if (papers.den < RHYTHM_MIN_PAPERS || papers.num !== papers.den) return null;
  const entries: Evidence[] = [];
  for (const d of days) {
    const v = map.get(d);
    const items: EvidenceItem[] = [...(hourSat(v) ? (["hour_sat"] as const) : []), ...(habitTicked(v) ? (["habit_ticked"] as const) : [])];
    if (items.length > 0) entries.push({ day: d, items });
  }
  for (const d of paperDays) if (paperSat(map.get(d))) entries.push({ day: d, items: ["paper_sat"] });
  return {
    id: "steady_rhythm",
    kind: "supporting",
    params: { hourDays: hour.num, hourOpen: hour.den, habitDays: habit.num, habitOpen: habit.den, papers: papers.den, window: CHAIN_DAYS },
    evidence: mergeEvidence(entries),
  };
}

// ---- Pattern 3: packaged or fried heavy days and a quieter next day (dragging; off until the owner says yes) -------------------------------
// Fires when, in the last 14 days, at least 4 days were half or more packaged or fried (of the items that carry a tag), at least 2 of them were
// followed by a quiet day, and the next days after them were quiet clearly more often than after the student's other meal days. The words never judge
// the food and never suggest eating less (brain-words.ts and its copy test); the contrast with other meal days keeps it honest.
export function packagedQuiet(map: DayMap, today: string): PatternHit | null {
  const days = windowDays(today, CHAIN_DAYS);
  if (loggedDaysIn(map, days) < MIN_LOGGED_DAYS) return null;
  const heavy = days.filter((d) => packagedHeavy(map.get(d)));
  if (heavy.length < MIN_HEAVY_MEAL_DAYS) return null;
  const chain = heavy.filter((d) => {
    const n = nextFinished(d, today);
    return n !== null && quiet(map.get(n));
  });
  if (chain.length < MIN_CHAIN_DAYS) return null;
  const others = days.filter((d) => map.get(d)?.H05 !== undefined && !heavy.includes(d));
  if (quietContrast(map, heavy, others, today) === null) return null;
  const entries: Evidence[] = [];
  for (const d of heavy) {
    entries.push({ day: d, items: ["packaged_heavy"] });
    const n = nextFinished(d, today);
    if (n !== null && chain.includes(d)) entries.push({ day: n, items: quietItems(map.get(n)) });
  }
  const evidence = mergeEvidence(entries);
  return {
    id: "packaged_quiet",
    kind: "dragging",
    params: { heavyDays: heavy.length, chainDays: chain.length, window: CHAIN_DAYS, from: evidence[0].day, to: evidence[evidence.length - 1].day },
    evidence,
  };
}

const RULES: Readonly<Record<PatternId, (map: DayMap, today: string) => PatternHit | null>> = {
  mood_habits_quiet: moodHabitsQuiet,
  steady_rhythm: steadyRhythm,
  packaged_quiet: packagedQuiet,
};

// Every pattern that fires on these days, minus the ones that are switched off or fail the food guard. The meals chain is evaluated only when the
// owner has turned it on (`foodOn`).
export function patternsOf(rows: readonly DayRow[], today: string, foodOn: boolean = FOOD_PATTERN_ON): PatternHit[] {
  const map = dayMapOf(rows);
  const out: PatternHit[] = [];
  for (const id of PATTERN_IDS) {
    if (id === "packaged_quiet" && !foodOn) continue;
    if (!foodGuardOk(PATTERN_META[id])) continue;
    const hit = RULES[id](map, today);
    if (hit !== null) out.push(hit);
  }
  return out;
}

// ---- The expression note (scope row 20) -------------------------------------------------------------------------------------------------------
// When a post of the student's was published within 7 days after a run of at least 2 days in a row marked sad or heavy, the Brain notes that they put it
// into words. Nothing is asked of them and nothing nudges them to write again. The most recent run with a post is used.
export function expressionNote(rows: readonly DayRow[], today: string): ExpressionHit | null {
  const map = dayMapOf(rows);
  const runs: string[][] = [];
  let current: string[] = [];
  for (const d of windowDays(today, CHAIN_DAYS)) {
    if (isLow(map.get(d))) current.push(d);
    else {
      if (current.length >= RUN_MIN) runs.push(current);
      current = [];
    }
  }
  if (current.length >= RUN_MIN) runs.push(current);
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const end = runs[i][runs[i].length - 1];
    for (let k = 0; k <= POST_WITHIN_DAYS; k += 1) {
      const d = shiftDay(end, k);
      if (d > today) break;
      if (map.get(d)?.E11 !== undefined) return { runDays: runs[i], postDay: d };
    }
  }
  return null;
}

// ---- The support offer (scope row 20) ---------------------------------------------------------------------------------------------------------
// When the last 7 days held at least 3 days marked sad or heavy, the share of open habit days ticked fell by 30 points or more against the week before
// (a habit open on at least 5 days in each week), and the days with a plate logged fell by 2 or more from at least 3 the week before, DHI says that support is
// available. It is computed when the student looks and is never stored, so it leaves no record for anyone else to see. It points to a short message and a
// helpline only: counseling is not part of the house yet.
export function supportOffer(rows: readonly DayRow[], today: string): SupportHit | null {
  const map = dayMapOf(rows);
  const last = windowDays(today, SUPPORT_WEEK);
  const prev = windowDays(shiftDay(today, -SUPPORT_WEEK), SUPPORT_WEEK);
  const lowDays = last.filter((d) => isLow(map.get(d))).length;
  if (lowDays < SUPPORT_LOW_DAYS) return null;
  const habitShare = (days: readonly string[]): { open: number; share: number } => {
    const open = days.filter((d) => map.get(d)?.H08 !== undefined);
    const ticked = open.filter((d) => habitTicked(map.get(d))).length;
    return { open: open.length, share: open.length === 0 ? 0 : ticked / open.length };
  };
  const now = habitShare(last);
  const before = habitShare(prev);
  if (now.open < SUPPORT_OPEN_DAYS || before.open < SUPPORT_OPEN_DAYS) return null;
  if (before.share - now.share < SUPPORT_HABIT_DROP) return null;
  const mealDays = (days: readonly string[]): number => days.filter((d) => map.get(d)?.H02 !== undefined).length;
  const meals = mealDays(last);
  const mealsBefore = mealDays(prev);
  if (mealsBefore < SUPPORT_MEAL_PREV || mealsBefore - meals < SUPPORT_MEAL_DROP) return null;
  return { lowDays, habitShare: now.share, prevHabitShare: before.share, mealDays: meals, prevMealDays: mealsBefore };
}

// ---- Growth lamps (scope row 21) ---------------------------------------------------------------------------------------------------------------
// Three lamps, each a growth mark from 0 to 1 over the student's own last 28 days, never a rank and never compared with another student. Each is the
// mean of the inputs that have something to measure; an input with nothing to measure is left out, so a room the student has not used never lowers a lamp.
//   Sadhana, effort and practice   papers sat before their window closed (A01), and days sat in an open study hour (H12)
//   Niyam, rhythm and discipline   days with a habit tick, of the days a habit was open (H08)
//   Viveka, reflection             films kept (A15): four films kept in the four weeks fill the lamp (VIVEKA_FULL), and none kept is nothing to measure
// Mood and meal logs are presence only and are not in any lamp. The score is the mean of the lamps that have a value, times 100 (homeRules.ts).
export const LAMP_METRICS: Readonly<Record<Lamp, readonly MetricId[]>> = { sadhana: ["A01", "H12"], niyam: ["H08"], viveka: ["A15"] };
export type LampInput = { metric: MetricId; value: number | null; logged: number };
export type LampView = { lamp: Lamp; value: number | null; movement: Movement | null; loggedDays: number; inputs: LampInput[] };

export function lampInputs(rows: readonly DayRow[], lamp: Lamp): LampInput[] {
  return LAMP_METRICS[lamp].map((metric) => {
    const p = periodOf(rows, metric);
    // Films are optional content: a student who kept none has nothing to measure here (not a zero), and four kept fill the lamp.
    if (metric === "A15") return { metric, value: p.num > 0 ? Math.min(1, p.num / VIVEKA_FULL) : null, logged: p.logged };
    return { metric, value: ratio(p.num, p.den), logged: p.logged };
  });
}

const lampDays = (rows: readonly DayRow[], lamp: Lamp): number => rows.filter((r) => LAMP_METRICS[lamp].some((m) => r.v[m] !== undefined)).length;

const within = (rows: readonly DayRow[], from: string, to: string): DayRow[] => rows.filter((r) => r.day >= from && r.day <= to);

// The three lamps with their movement. `today` is part of the window (the in progress day counts for what it already holds). Movement compares the last
// 14 days with the 14 before: it is said only when both halves have a value and at least 3 logged days, and it is "rising" or "dipping" only by a clear
// rise (10 points of the 0 to 1 scale).
export function lampsOf(rows: readonly DayRow[], today: string): { score: number | null; lamps: LampView[] } {
  const from = shiftDay(today, -(LAMP_WINDOW - 1));
  const midFrom = shiftDay(today, -(MOVE_WINDOW - 1));
  const midTo = shiftDay(today, -MOVE_WINDOW);
  const all = within(rows, from, today);
  const recent = within(rows, midFrom, today);
  const earlier = within(rows, from, midTo);
  const lamps: LampView[] = LAMPS.map((lamp) => {
    const inputs = lampInputs(all, lamp);
    const value = lampValue(inputs.map((i) => i.value));
    const a = lampValue(lampInputs(recent, lamp).map((i) => i.value));
    const b = lampValue(lampInputs(earlier, lamp).map((i) => i.value));
    let movement: Movement | null = null;
    if (a !== null && b !== null && lampDays(recent, lamp) >= MOVE_MIN_DAYS && lampDays(earlier, lamp) >= MOVE_MIN_DAYS) {
      // In whole thousandths: 0.6 - 0.5 is 0.0999... as a float and must read the same as 0.4 - 0.3, which is 0.1000...3.
      const change = Math.round((a - b) * 1000) / 1000;
      movement = change >= CLEAR_RISE ? "rising" : change <= -CLEAR_RISE ? "dipping" : "steady";
    }
    return { lamp, value, movement, loggedDays: lampDays(all, lamp), inputs };
  });
  return { score: scoreOf({ sadhana: lamps[0].value, niyam: lamps[1].value, viveka: lamps[2].value }), lamps };
}

// ---- Coverage, for the empty state ---------------------------------------------------------------------------------------------------------------
// The days in the last 14 finished days on which the student logged something in each room, so a student with little logged is told what to log and where.
// A habit counts on a day it was ticked, the study hour on a day it was sat, and papers on a day one was sat: not on a day that holds only a zero.
export const COVERAGE_METRICS: Readonly<Record<string, MetricId>> = { mood: "E01", habits: "H08", day: "H02", sleep: "H06", papers: "A01", hour: "X01", modules: "A15", blog: "E11" };
export function coverageOf(rows: readonly DayRow[], today: string): { room: string; days: number }[] {
  return coverageIn(rows, today, CHAIN_DAYS);
}
// The same count over the last `n` finished days (the parent's week is the last 7).
export function coverageIn(rows: readonly DayRow[], today: string, n: number): { room: string; days: number }[] {
  const map = dayMapOf(rows);
  const days = windowDays(today, n);
  return Object.entries(COVERAGE_METRICS).map(([room, metric]) => ({
    room,
    days: days.filter((d) => {
      const value = map.get(d)?.[metric];
      return value !== undefined && didSomething(metric, value);
    }).length,
  }));
}
