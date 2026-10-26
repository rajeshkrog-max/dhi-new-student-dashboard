// The Brain's patterns, notes, lamps and movement (spec house/0020, scope rows 18 to 21). Every rule has a hand made fixture that fires it and a near
// miss that stays silent, and the evidence lists the days behind each hit. The fixtures are the plans of brainFixtures.ts (the days back from today).
import { describe, expect, test } from "vitest";
import { HEAVY_PLAN, PACKAGED_PLAN, STEADY_PLAN, rowsFromPlan, type Plan } from "./brainFixtures";
import {
  CHAIN_DAYS,
  CLEAR_RISE,
  VIVEKA_FULL,
  EVIDENCE_ROOM,
  FOOD_MEASURES,
  FOOD_PATTERN_ON,
  HIDEABLE_IDS,
  MIN_LOGGED_DAYS,
  PATTERN_IDS,
  PATTERN_META,
  coverageOf,
  dayMapOf,
  expressionNote,
  foodGuardOk,
  isHideable,
  isPatternId,
  lampsOf,
  loggedDaysIn,
  patternsOf,
  supportOffer,
  windowDays,
  type EvidenceItem,
} from "./brainRules";
import { shiftDay } from "./dayRules";
import type { DayRow } from "./metricRules";

const TODAY = "2026-10-20";
const back = (n: number) => shiftDay(TODAY, -n);
const plan = (base: Plan, change: Partial<Plan>): Plan => ({ ...base, ...change });
const rowsOf = (p: Plan) => rowsFromPlan(p, TODAY);
const hit = (p: Plan, id: string, foodOn = false) => patternsOf(rowsOf(p), TODAY, foodOn).find((x) => x.id === id) ?? null;
const evidenceItems = (h: NonNullable<ReturnType<typeof hit>>, offset: number) => h.evidence.find((e) => e.day === back(offset))?.items;

describe("the first chain: heavy days, habits not ticked, a quieter next day (AC-1)", () => {
  test("covers AC-1: it fires on the heavy fortnight and its evidence lists the days and what happened on each", () => {
    const h = hit(HEAVY_PLAN, "mood_habits_quiet")!;
    expect(h).toMatchObject({ id: "mood_habits_quiet", kind: "dragging" });
    expect(h.params).toEqual({ lowDays: 5, chainDays: 5, window: CHAIN_DAYS, from: back(9), to: back(2) });
    expect(h.evidence.map((e) => e.day)).toEqual([9, 8, 7, 6, 5, 4, 3, 2].map(back));
    expect(evidenceItems(h, 9)).toEqual(["low_mood", "habit_not_ticked"]);
    expect(evidenceItems(h, 8)).toEqual(["low_mood", "habit_not_ticked", "hour_not_sat"]);
    expect(evidenceItems(h, 7)).toEqual(["hour_not_sat"]);
    expect(evidenceItems(h, 5)).toEqual(["paper_missed"]);
    expect(evidenceItems(h, 2)).toEqual(["hour_not_sat"]);
    for (const e of h.evidence) for (const item of e.items) expect(EVIDENCE_ROOM[item as EvidenceItem], item).toBeTruthy();
  });

  test("covers AC-1: it stays silent when the low days are only two, or spread over more than a week", () => {
    expect(hit(plan(HEAVY_PLAN, { low: [9, 8] }), "mood_habits_quiet")).toBeNull();
    expect(hit(plan(HEAVY_PLAN, { low: [12, 8, 4] }), "mood_habits_quiet")).toBeNull();
    // Three low days inside seven days is the least that clusters.
    expect(hit(plan(HEAVY_PLAN, { low: [9, 8, 6] }), "mood_habits_quiet")).not.toBeNull();
  });

  test("covers AC-1: it stays silent when only one day carries every link of the chain", () => {
    // Habits ticked on all the low days but one: one chain day.
    expect(hit(plan(HEAVY_PLAN, { habitTicked: [14, 13, 12, 11, 10, 7, 2, 8, 6, 4, 3] }), "mood_habits_quiet")).toBeNull();
    // Two chain days is enough.
    expect(hit(plan(HEAVY_PLAN, { habitTicked: [14, 13, 12, 11, 10, 7, 2, 6, 4, 3] }), "mood_habits_quiet")).not.toBeNull();
    // No quiet day after any low day: the study hour sat every day and no paper missed.
    expect(hit(plan(HEAVY_PLAN, { hourSat: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], papers: [] }), "mood_habits_quiet")).toBeNull();
  });

  test("covers AC-1: a student who is quiet every day does not trigger it, because the other days are compared", () => {
    expect(hit(plan(HEAVY_PLAN, { hourSat: [] }), "mood_habits_quiet")).toBeNull();
  });

  test("covers AC-1: nothing is said before 5 days have something logged, and a day with no log is never a quiet day", () => {
    const thin = plan(HEAVY_PLAN, { moodLogged: [9, 8, 6], low: [9, 8, 6], habitOpen: [9, 8, 6], habitTicked: [], hourOpen: [8, 7, 5], hourSat: [], papers: [], meals: [], posts: [] });
    expect(rowsOf(thin).length).toBeLessThan(MIN_LOGGED_DAYS + 3);
    expect(hit(thin, "mood_habits_quiet")).toBeNull();
    // The next days of the low days have no study hour and no paper at all: nothing was expected, so they are not quiet.
    expect(hit(plan(HEAVY_PLAN, { hourOpen: [], hourSat: [], papers: [] }), "mood_habits_quiet")).toBeNull();
  });

  test("covers AC-1: today, still in progress, never changes a chain", () => {
    const base = patternsOf(rowsOf(HEAVY_PLAN), TODAY, false);
    const withToday = [...rowsOf(HEAVY_PLAN), { day: TODAY, v: { E03: { num: 1, den: 1 }, H08: { num: 0, den: 1 }, X01: { num: 0, den: 1 } } }];
    expect(patternsOf(withToday, TODAY, false)).toEqual(base);
  });

  test("covers AC-1: the same days always give the same answer and the input is never changed", () => {
    const rows = rowsOf(HEAVY_PLAN);
    const frozen = JSON.parse(JSON.stringify(rows));
    const first = patternsOf(rows, TODAY, true);
    expect(patternsOf(rows, TODAY, true)).toEqual(first);
    expect(rows).toEqual(frozen);
  });
});

describe("the supporting pattern: a steady rhythm and papers sat (AC-2)", () => {
  test("covers AC-2: it fires on the steady month with the counts and the days behind it", () => {
    const h = hit(STEADY_PLAN, "steady_rhythm")!;
    expect(h).toMatchObject({ id: "steady_rhythm", kind: "supporting" });
    expect(h.params).toEqual({ hourDays: 11, hourOpen: 14, habitDays: 12, habitOpen: 14, papers: 2, window: CHAIN_DAYS });
    expect(evidenceItems(h, 1)).toEqual(["habit_ticked", "hour_sat"]);
    expect(evidenceItems(h, 6)).toEqual(["habit_ticked", "hour_sat", "paper_sat"]);
    expect(evidenceItems(h, 20)).toEqual(["paper_sat"]);
    expect(evidenceItems(h, 10)).toEqual(["habit_ticked"]);
  });

  test("covers AC-2: it stays silent one short of each condition", () => {
    const lastTwoWeeks = (list: number[]) => [28, 26, 24, 21, 17, ...list];
    // Study hour days: 9 of 14 is 64 percent and fires; 8 of 14 is 57 percent and does not. And 4 days sat is the least that counts.
    expect(hit(plan(STEADY_PLAN, { hourSat: lastTwoWeeks([14, 13, 12, 11, 9, 8, 6, 5, 4]) }), "steady_rhythm")).not.toBeNull();
    expect(hit(plan(STEADY_PLAN, { hourSat: lastTwoWeeks([14, 13, 12, 11, 9, 8, 6, 5]) }), "steady_rhythm")).toBeNull();
    // Habit ticks: 10 of 14 is 71 percent and fires; 9 of 14 is 64 percent and does not.
    expect(hit(plan(STEADY_PLAN, { habitTicked: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5] }), "steady_rhythm")).not.toBeNull();
    expect(hit(plan(STEADY_PLAN, { habitTicked: [14, 13, 12, 11, 10, 9, 8, 7, 6] }), "steady_rhythm")).toBeNull();
    // Habit open on 7 days is fewer than 8 days.
    expect(hit(plan(STEADY_PLAN, { habitOpen: [7, 6, 5, 4, 3, 2, 1], habitTicked: [7, 6, 5, 4, 3, 2, 1] }), "steady_rhythm")).toBeNull();
    // One paper is not enough, and a paper not sat breaks it.
    expect(hit(plan(STEADY_PLAN, { papers: [{ back: 6, sat: 1, missed: 0 }] }), "steady_rhythm")).toBeNull();
    expect(hit(plan(STEADY_PLAN, { papers: [{ back: 20, sat: 1, missed: 0 }, { back: 6, sat: 1, missed: 1 }] }), "steady_rhythm")).toBeNull();
    // The papers look reaches back 28 days: a second paper on the 28th day back counts, on the 29th it does not.
    expect(hit(plan(STEADY_PLAN, { papers: [{ back: 28, sat: 1, missed: 0 }, { back: 6, sat: 1, missed: 0 }] }), "steady_rhythm")).not.toBeNull();
    expect(hit(plan(STEADY_PLAN, { papers: [{ back: 29, sat: 1, missed: 0 }, { back: 6, sat: 1, missed: 0 }] }), "steady_rhythm")).toBeNull();
  });
});

describe("the meals chain: packaged or fried heavy days, a quieter next day (AC-3)", () => {
  test("covers AC-3: it is off by default, and fires on its fixture when it is switched on", () => {
    expect(FOOD_PATTERN_ON).toBe(false);
    expect(patternsOf(rowsOf(PACKAGED_PLAN), TODAY).map((p) => p.id)).not.toContain("packaged_quiet");
    const h = hit(PACKAGED_PLAN, "packaged_quiet", true)!;
    expect(h).toMatchObject({ id: "packaged_quiet", kind: "dragging" });
    expect(h.params).toMatchObject({ heavyDays: 4, chainDays: 4, window: CHAIN_DAYS });
    expect(evidenceItems(h, 11)).toEqual(["packaged_heavy"]);
    expect(evidenceItems(h, 10)).toEqual(["hour_not_sat"]);
  });

  test("covers AC-3: it stays silent one short, and for a student who is quiet whatever they ate", () => {
    expect(hit(plan(PACKAGED_PLAN, { heavyMeals: [11, 8, 5] }), "packaged_quiet", true)).toBeNull();
    expect(hit(plan(PACKAGED_PLAN, { heavyMeals: [11, 8, 5, 3], hourSat: [] }), "packaged_quiet", true)).toBeNull();
    // Only one heavy day followed by a quiet day.
    expect(hit(plan(PACKAGED_PLAN, { hourSat: [14, 13, 12, 11, 10, 9, 8, 6, 5, 4, 3, 2, 1] }), "packaged_quiet", true)).toBeNull();
  });

  test("covers AC-3: supporting and dragging patterns stay separate, and no pattern fires on a student with nothing logged", () => {
    expect(patternsOf([], TODAY, true)).toEqual([]);
    const both = patternsOf(rowsOf(HEAVY_PLAN), TODAY, true);
    expect(both.every((p) => p.kind === PATTERN_META[p.id].kind)).toBe(true);
    expect(both.filter((p) => p.kind === "supporting")).toEqual([]);
  });
});

describe("the food guard (AC-3)", () => {
  test("covers AC-3: no supporting pattern reads a meal measure, and a meal measure appears only as the packaged or fried share of a dragging one", () => {
    for (const id of PATTERN_IDS) {
      const meta = PATTERN_META[id];
      expect(foodGuardOk(meta), id).toBe(true);
      if (meta.kind === "supporting") expect(meta.uses.some((m) => FOOD_MEASURES.includes(m)), id).toBe(false);
    }
    expect(foodGuardOk({ kind: "supporting", uses: ["H05"] })).toBe(false);
    expect(foodGuardOk({ kind: "supporting", uses: ["H02"] })).toBe(false);
    expect(foodGuardOk({ kind: "dragging", uses: ["H02"] })).toBe(false);
    expect(foodGuardOk({ kind: "dragging", uses: ["H01"] })).toBe(false);
    expect(foodGuardOk({ kind: "dragging", uses: ["H04"] })).toBe(false);
    expect(foodGuardOk({ kind: "dragging", uses: ["H05", "X01"] })).toBe(true);
    expect(foodGuardOk({ kind: "supporting", uses: ["H12", "H08"] })).toBe(true);
  });
});

describe("the expression note (AC-4)", () => {
  test("covers AC-4: after a run of low days a post published within 7 days is noted, using the most recent run", () => {
    expect(expressionNote(rowsOf(HEAVY_PLAN), TODAY)).toEqual({ runDays: [back(4), back(3)], postDay: back(2) });
    // The post on the same day the run ends counts too.
    expect(expressionNote(rowsOf(plan(HEAVY_PLAN, { posts: [3] })), TODAY)).toEqual({ runDays: [back(4), back(3)], postDay: back(3) });
  });

  test("covers AC-4: it is silent with no post, a post before the run, a post 8 days after, or a single low day", () => {
    expect(expressionNote(rowsOf(plan(HEAVY_PLAN, { posts: [] })), TODAY)).toBeNull();
    expect(expressionNote(rowsOf(plan(HEAVY_PLAN, { posts: [13] })), TODAY)).toBeNull();
    const longAgo = plan(HEAVY_PLAN, { low: [12, 11], posts: [] });
    expect(expressionNote(rowsOf({ ...longAgo, posts: [4] }), TODAY)).toEqual({ runDays: [back(12), back(11)], postDay: back(4) });
    expect(expressionNote(rowsOf({ ...longAgo, posts: [3] }), TODAY)).toBeNull();
    expect(expressionNote(rowsOf(plan(HEAVY_PLAN, { low: [9, 6, 3], posts: [2] })), TODAY)).toBeNull();
  });

  test("covers AC-4: a day with no mood logged breaks a run, and the note carries days only, never a word of what was written", () => {
    expect(expressionNote(rowsOf(plan(HEAVY_PLAN, { low: [9, 7], moodLogged: [14, 13, 12, 11, 10, 9, 7, 6, 5], posts: [6] })), TODAY)).toBeNull();
    const note = expressionNote(rowsOf(HEAVY_PLAN), TODAY)!;
    expect(Object.keys(note).sort()).toEqual(["postDay", "runDays"]);
  });
});

describe("the support offer (AC-5)", () => {
  test("covers AC-5: it fires when the week held 3 low days and habits and plates fell against the week before", () => {
    const s = supportOffer(rowsOf(HEAVY_PLAN), TODAY)!;
    expect(s.lowDays).toBe(3);
    expect(s.habitShare).toBeCloseTo(2 / 7, 6);
    expect(s.prevHabitShare).toBeCloseTo(5 / 7, 6);
    expect(s.mealDays).toBe(2);
    expect(s.prevMealDays).toBe(6);
  });

  test("covers AC-5: it is silent one short of each condition", () => {
    // Two low days in the last week.
    expect(supportOffer(rowsOf(plan(HEAVY_PLAN, { low: [9, 8, 6, 4] })), TODAY)).toBeNull();
    // The habit share falls by 28.6 points (3 of 7 against 5 of 7), less than 30.
    expect(supportOffer(rowsOf(plan(HEAVY_PLAN, { habitTicked: [14, 13, 12, 11, 10, 7, 2, 5] })), TODAY)).toBeNull();
    // Plates fall by 1 (5 days against 6).
    expect(supportOffer(rowsOf(plan(HEAVY_PLAN, { meals: [14, 13, 12, 11, 10, 9, 7, 6, 5, 4, 3] })), TODAY)).toBeNull();
    // The week before had only 2 days with a plate: nothing to fall from.
    expect(supportOffer(rowsOf(plan(HEAVY_PLAN, { meals: [10, 9, 6, 5] })), TODAY)).toBeNull();
    // A habit open on only 4 days of the last week.
    expect(supportOffer(rowsOf(plan(HEAVY_PLAN, { habitOpen: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4] })), TODAY)).toBeNull();
  });

  test("covers AC-5: it names no day, no mood and no record, and a student with nothing logged has none", () => {
    expect(Object.keys(supportOffer(rowsOf(HEAVY_PLAN), TODAY)!).sort()).toEqual(["habitShare", "lowDays", "mealDays", "prevHabitShare", "prevMealDays"]);
    expect(supportOffer([], TODAY)).toBeNull();
  });
});

describe("the growth lamps (AC-6)", () => {
  test("covers AC-6: each lamp is the mean of its inputs that have something to measure, and the score is the mean of the lamps", () => {
    const { score, lamps } = lampsOf(rowsOf(STEADY_PLAN), TODAY);
    const [sadhana, niyam, viveka] = lamps;
    expect(lamps.map((l) => l.lamp)).toEqual(["sadhana", "niyam", "viveka"]);
    expect(sadhana.inputs.map((i) => [i.metric, i.value])).toEqual([
      ["A01", 1],
      ["H12", 15 / 27],
    ]);
    expect(sadhana.value).toBeCloseTo((1 + 15 / 27) / 2, 10);
    expect(niyam.inputs).toEqual([{ metric: "H08", value: 17 / 27, logged: 27 }]);
    expect(viveka.value).toBeNull();
    expect(score).toBe(Math.round(((1 + 15 / 27) / 2 + 17 / 27) * 50));
  });

  test("covers AC-6: a lamp with nothing to measure is left out of the score, never counted as zero", () => {
    const { score, lamps } = lampsOf(rowsOf(plan(STEADY_PLAN, { hourOpen: [], hourSat: [], papers: [] })), TODAY);
    expect(lamps[0].value).toBeNull();
    expect(lamps[1].value).toBeCloseTo(17 / 27, 10);
    expect(score).toBe(Math.round((17 / 27) * 100));
    expect(lampsOf([], TODAY)).toMatchObject({ score: null });
  });

  test("covers AC-6: movement compares the last 14 days with the 14 before, by a clear rise only", () => {
    const { lamps } = lampsOf(rowsOf(STEADY_PLAN), TODAY);
    expect(lamps.map((l) => l.movement)).toEqual(["rising", "rising", null]);
    // The reverse month dips.
    const mirrored: Plan = {
      ...STEADY_PLAN,
      habitTicked: [28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 3, 2],
      hourSat: [28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 2],
      papers: [{ back: 20, sat: 1, missed: 0 }, { back: 6, sat: 0, missed: 1 }],
    };
    expect(lampsOf(rowsOf(mirrored), TODAY).lamps.map((l) => l.movement)).toEqual(["dipping", "dipping", null]);
    // A change smaller than the clear rise is steady: the same ticks in both halves.
    const flat: Plan = { ...STEADY_PLAN, habitTicked: [28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2], hourOpen: [], hourSat: [], papers: [] };
    expect(lampsOf(rowsOf(flat), TODAY).lamps[1].movement).toBe("steady");
    expect(CLEAR_RISE).toBe(0.1);
  });

  test("covers AC-6: movement is not said when a half has fewer than 3 logged days or no value", () => {
    const recentOnly = plan(STEADY_PLAN, { habitOpen: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], habitTicked: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] });
    expect(lampsOf(rowsOf(recentOnly), TODAY).lamps[1].movement).toBeNull();
    const twoDaysBefore = plan(recentOnly, { habitOpen: [...recentOnly.habitOpen, 20, 19], habitTicked: [...recentOnly.habitTicked, 20] });
    expect(lampsOf(rowsOf(twoDaysBefore), TODAY).lamps[1].movement).toBeNull();
    const threeDaysBefore = plan(recentOnly, { habitOpen: [...recentOnly.habitOpen, 20, 19, 18], habitTicked: [...recentOnly.habitTicked, 20] });
    expect(lampsOf(rowsOf(threeDaysBefore), TODAY).lamps[1].movement).toBe("rising");
  });

  test("covers AC-6: Viveka is the films kept, four kept in the four weeks fill the lamp, and films not watched never lower it", () => {
    // Two films kept is half the lamp, and four or more fill it.
    expect(lampsOf(rowsOf(plan(STEADY_PLAN, { kept: [5, 3] })), TODAY).lamps[2].value).toBe(0.5);
    expect(lampsOf(rowsOf(plan(STEADY_PLAN, { kept: [9, 6, 3, 1] })), TODAY).lamps[2].value).toBe(1);
    expect(lampsOf(rowsOf(plan(STEADY_PLAN, { kept: [9, 8, 7, 6, 5, 4] })), TODAY).lamps[2].value).toBe(1);
    // None kept is nothing to measure, not a zero, so a student who has not started the films has no Viveka lamp and the score is the other two.
    const none = lampsOf(rowsOf(STEADY_PLAN), TODAY);
    expect(none.lamps[2].value).toBeNull();
    expect(none.lamps[2].inputs).toEqual([{ metric: "A15", value: null, logged: 0 }]);
    // Films kept before the four week window do not count.
    expect(lampsOf(rowsOf(plan(STEADY_PLAN, { kept: [40, 35] })), TODAY).lamps[2].value).toBeNull();
    expect(VIVEKA_FULL).toBe(4);
  });

  test("covers AC-6: mood and meal logs are in no lamp, so a student who only logs them has no score", () => {
    const logOnly = plan(STEADY_PLAN, { habitOpen: [], habitTicked: [], hourOpen: [], hourSat: [], papers: [], meals: range(14), moodLogged: range(14) });
    expect(lampsOf(rowsOf(logOnly), TODAY).score).toBeNull();
  });

  // Fourteen recent days and fourteen earlier days, each holding the Niyam value (a tick or not) of one open habit.
  const niyamRows = (recentTicked: number, earlierTicked: number): DayRow[] => {
    const rows: DayRow[] = [];
    for (let i = 0; i < 10; i += 1) rows.push({ day: back(i), v: { H08: { num: i < recentTicked ? 1 : 0, den: 1 } } });
    for (let i = 0; i < 10; i += 1) rows.push({ day: back(14 + i), v: { H08: { num: i < earlierTicked ? 1 : 0, den: 1 } } });
    return rows;
  };

  test("covers AC-6: a rise of 0.6 over 0.5 and of 0.4 over 0.3 are both a clear rise, whatever the float arithmetic says", () => {
    expect(lampsOf(niyamRows(6, 5), TODAY).lamps[1].movement).toBe("rising");
    expect(lampsOf(niyamRows(4, 3), TODAY).lamps[1].movement).toBe("rising");
    expect(lampsOf(niyamRows(5, 6), TODAY).lamps[1].movement).toBe("dipping");
    expect(lampsOf(niyamRows(3, 4), TODAY).lamps[1].movement).toBe("dipping");
    // Nine hundredths is not clear.
    expect(lampsOf([...niyamRows(5, 5)], TODAY).lamps[1].movement).toBe("steady");
  });

  test("covers AC-6: days holding only a real zero are not logged days, in the chains or in the coverage", () => {
    const zeroPlan = plan(STEADY_PLAN, { moodLogged: [], low: [], habitOpen: range(14), habitTicked: [], hourOpen: range(14), hourSat: [], papers: [], meals: [], heavyMeals: [], posts: [], kept: [] });
    const rows = rowsOf(zeroPlan);
    expect(rows.length).toBeGreaterThan(0);
    expect(loggedDaysIn(dayMapOf(rows), windowDays(TODAY, 14))).toBe(0);
    expect(coverageOf(rows, TODAY).every((c) => c.days === 0)).toBe(true);
    expect(patternsOf(rows, TODAY, true)).toEqual([]);
  });

  test("covers AC-1: a chain stays silent with only 3 logged days, however many days hold a zero", () => {
    const three = plan(HEAVY_PLAN, { moodLogged: [9, 8, 6], low: [9, 8, 6], habitOpen: range(14), habitTicked: [], hourOpen: range(14), hourSat: [], papers: [], meals: [], heavyMeals: [], posts: [], kept: [] });
    expect(loggedDaysIn(dayMapOf(rowsOf(three)), windowDays(TODAY, 14))).toBe(3);
    expect(hit(three, "mood_habits_quiet")).toBeNull();
  });
});

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe("the page's small pieces (AC-7)", () => {
  test("covers AC-7: coverage counts the days in the last 14 with a value for each room, the empty student has none, and the window ends yesterday", () => {
    const cov = Object.fromEntries(coverageOf(rowsOf(HEAVY_PLAN), TODAY).map((c) => [c.room, c.days]));
    expect(cov).toMatchObject({ mood: 14, habits: 7, day: 8, papers: 0, hour: 10, blog: 1, sleep: 0, modules: 0 });
    expect(coverageOf([], TODAY).every((c) => c.days === 0)).toBe(true);
    expect(windowDays(TODAY, 3)).toEqual([back(3), back(2), back(1)]);
  });

  test("covers AC-7: only the three patterns, the four connections (house spec 0023) and the expression note can be hidden", () => {
    expect([...HIDEABLE_IDS].sort()).toEqual(["bedtime_mood", "breakfast_focus", "expression", "late_room_feeling", "mood_habits_quiet", "packaged_quiet", "sleep_papers", "steady_rhythm"]);
    for (const id of PATTERN_IDS) expect(isHideable(id) && isPatternId(id)).toBe(true);
    expect(isHideable("support")).toBe(false);
    expect(isHideable("")).toBe(false);
    expect(isHideable(undefined)).toBe(false);
  });
});
