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

export const SCENARIOS = ["heavy", "steady", "packaged"] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const isScenario = (text: unknown): text is Scenario => typeof text === "string" && (SCENARIOS as readonly string[]).includes(text);
const PLANS: Readonly<Record<Scenario, Plan>> = { heavy: HEAVY_PLAN, steady: STEADY_PLAN, packaged: PACKAGED_PLAN };
export const scenarioRows = (scenario: Scenario, today: string): DayRow[] => rowsFromPlan(PLANS[scenario], today);
