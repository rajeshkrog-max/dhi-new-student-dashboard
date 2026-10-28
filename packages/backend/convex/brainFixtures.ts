// Hand made weeks for the Brain (spec house/0019 and house/0020): the tests use them to prove each rule fires and stays silent just short of its
// threshold, and the development helper (brainProof.ts) writes the same days for a made up student so the Progress page can be seen. A plan lists,
// by the number of days back (1 is yesterday), what happened on which day; `rowsFromPlan` turns it into the daily values the rollup would have stored
// (metricRules.ts). No database and no clock: the caller passes the house day it is today. Made up numbers only; nothing here is a real student's.
import { shiftDay } from "./dayRules";
import type { DayRow, DayValues } from "./metricRules";

export type Plan = {
  moodLogged: number[]; // days back with a mood logged
  low: number[]; // of those, days marked sad or heavy
  habitOpen: number[]; // days back where a habit was open
  habitTicked: number[]; // of those, days it was ticked
  hourOpen: number[]; // days back where a study hour was open
  hourSat: number[]; // of those, days sat for 20 minutes or more
  papers: { back: number; sat: number; missed: number }[]; // papers that closed that day
  meals: number[]; // days back with a plate logged (two food groups)
  heavyMeals: number[]; // of those, days with half or more of the tagged items packaged or fried
  posts: number[]; // days back a post was published
  kept: number[]; // days back a film was kept
};

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = from; i >= to; i -= 1) out.push(i);
  return out;
};
const empty = (): Plan => ({ moodLogged: [], low: [], habitOpen: [], habitTicked: [], hourOpen: [], hourSat: [], papers: [], meals: [], heavyMeals: [], posts: [], kept: [] });

export function rowsFromPlan(plan: Plan, today: string): DayRow[] {
  const days = new Map<number, DayValues>();
  const put = (back: number, values: DayValues) => days.set(back, { ...(days.get(back) ?? {}), ...values });
  for (const b of plan.moodLogged) put(b, { E01: { num: 1, den: 1 }, E02: { num: 0, den: 1 }, E03: { num: plan.low.includes(b) ? 1 : 0, den: 1 } });
  for (const b of plan.habitOpen) put(b, { H08: { num: plan.habitTicked.includes(b) ? 1 : 0, den: 1 } });
  for (const b of plan.hourOpen) {
    const sat = plan.hourSat.includes(b);
    put(b, { X01: { num: sat ? 30 : 0, den: 1 }, H12: { num: sat ? 1 : 0, den: 1 } });
  }
  for (const p of plan.papers) put(p.back, { A01: { num: p.sat, den: p.sat + p.missed } });
  for (const b of plan.meals) put(b, { H02: { num: 2, den: 5 }, ...(plan.heavyMeals.includes(b) ? { H05: { num: 2, den: 3 } } : { H05: { num: 0, den: 3 } }) });
  for (const b of plan.posts) put(b, { E11: { num: 1, den: 1 } });
  for (const b of plan.kept) put(b, { A15: { num: 1, den: 1 } });
  return [...days.entries()]
    .sort(([a], [b]) => b - a)
    .map(([back, v]) => ({ day: shiftDay(today, -back), v: { ...v, C01: { num: 1, den: 1 } } }));
}

// A heavy fortnight: five days marked sad or heavy, in two runs; a habit open every day and ticked on only some; the study hour open every day and not
// sat on four; a paper that closed unsat; the plates fewer than the week before; a post published after the second run. It makes the first chain, the
// expression note and the support offer fire together.
export const HEAVY_PLAN: Plan = {
  ...empty(),
  moodLogged: range(14, 1),
  low: [9, 8, 6, 4, 3],
  habitOpen: range(14, 1),
  habitTicked: [14, 13, 12, 11, 10, 7, 2],
  hourOpen: range(14, 1),
  hourSat: [14, 13, 12, 11, 10, 9, 6, 5, 4, 1],
  papers: [{ back: 5, sat: 0, missed: 1 }],
  meals: [14, 13, 12, 11, 10, 9, 6, 5],
  posts: [2],
};

// A steady month: the study hour sat on most days of the last two weeks, a habit ticked on almost all of them, two papers sat, and the two weeks
// before a little lighter, so the lamps rise. It makes the supporting pattern fire.
export const STEADY_PLAN: Plan = {
  ...empty(),
  moodLogged: range(14, 3),
  habitOpen: range(28, 1),
  habitTicked: [...range(28, 15).filter((b) => b % 2 === 0 || b === 23).slice(0, 6), ...range(14, 1).filter((b) => b !== 9 && b !== 4)],
  hourOpen: range(28, 1),
  hourSat: [28, 26, 24, 21, 17, ...range(14, 1).filter((b) => ![10, 7, 3].includes(b))],
  papers: [
    { back: 20, sat: 1, missed: 0 },
    { back: 6, sat: 1, missed: 0 },
  ],
  meals: range(14, 1),
};

// Packaged or fried heavy days followed by quiet days, against ordinary days followed by sat days. It makes the meals chain fire when that chain is on.
export const PACKAGED_PLAN: Plan = {
  ...empty(),
  moodLogged: range(14, 1),
  habitOpen: range(14, 1),
  habitTicked: range(14, 1),
  hourOpen: range(14, 1),
  hourSat: [14, 13, 12, 11, 9, 8, 6, 5, 3, 1],
  meals: range(14, 1),
  heavyMeals: [11, 8, 5, 3],
};

// Forty finished days for the connections (house spec 0023): on the 20 early nights (bed before 23:30) the mood is light, on the 20 late nights
// it is heavy, so the bedtime and mood pair shows a clear difference. Only for the browser proof of the connections; no pattern reads these alone.
export function connectedRows(today: string): DayRow[] {
  const rows: DayRow[] = [];
  for (let back = 40; back >= 1; back -= 1) {
    const late = back % 2 === 0;
    // All three mood bands, as a real mood day holds them: light on the early nights, heavy on the late ones.
    rows.push({ day: shiftDay(today, -back), v: { H06: { num: late ? 750 : 630, den: 1 }, E06L: { num: late ? 0 : 1, den: 1 }, E06S: { num: 0, den: 1 }, E06H: { num: late ? 1 : 0, den: 1 }, C01: { num: 1, den: 1 } } });
  }
  return rows.reverse();
}

// Sixty finished days for the tagged connections (house spec 0028). Desk days and paper days take turns. On a desk day the student tagged a sitting
// with one topic (`seedtopica`) and two maths sessions, one of them drained, and one english session that was not. On the paper day after it, the
// answers on that topic were mostly right and on a topic with no sitting the day before (`seedtopicb`) fewer were. So P4 and P6 both show. The topic
// ids are made up: the engine matches them only to each other.
export const SEED_TOPIC_A = "seedtopica";
export const SEED_TOPIC_B = "seedtopicb";
export function taggedRows(today: string): DayRow[] {
  const rows: DayRow[] = [];
  for (let back = 60; back >= 1; back -= 1) {
    const deskDay = back % 2 === 0;
    rows.push({
      day: shiftDay(today, -back),
      v: deskDay ? { E09: { num: 2, den: 3 }, C01: { num: 1, den: 1 } } : { A02: { num: 13, den: 20 }, C01: { num: 1, den: 1 } },
      t: deskDay
        ? { [`d:${SEED_TOPIC_A}`]: { num: 1, den: 1 }, "s:maths": { num: 1, den: 2 }, "s:english": { num: 0, den: 1 } }
        : { [`p:${SEED_TOPIC_A}`]: { num: 9, den: 10 }, [`p:${SEED_TOPIC_B}`]: { num: 4, den: 10 } },
    });
  }
  return rows;
}

// The responsive sweep's days: the heavy fortnight's measures with the tagged days' tags under them, so one page holds the chain, the expression note,
// the support offer and the two tagged connections.
export function sweepRows(today: string): DayRow[] {
  const heavy = new Map(rowsFromPlan(HEAVY_PLAN, today).map((r) => [r.day, r.v] as const));
  const rows = taggedRows(today).map((r) => ({ ...r, v: heavy.get(r.day) ?? r.v }));
  for (const [day, v] of heavy) if (!rows.some((r) => r.day === day)) rows.push({ day, v });
  return rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export const SCENARIOS = ["heavy", "steady", "packaged", "connected", "tagged", "sweep"] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const isScenario = (text: unknown): text is Scenario => typeof text === "string" && (SCENARIOS as readonly string[]).includes(text);
const PLANS: Readonly<Record<Exclude<Scenario, "connected" | "tagged" | "sweep">, Plan>> = { heavy: HEAVY_PLAN, steady: STEADY_PLAN, packaged: PACKAGED_PLAN };
export const scenarioRows = (scenario: Scenario, today: string): DayRow[] =>
  scenario === "connected" ? connectedRows(today) : scenario === "tagged" ? taggedRows(today) : scenario === "sweep" ? sweepRows(today) : rowsFromPlan(PLANS[scenario], today);
