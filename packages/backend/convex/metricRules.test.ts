// The Brain's daily values (spec house/0019, scope row 17). One hand made day or week of events for each measure, with the expected top and bottom
// written beside it, and the rules that keep the numbers honest: a week is the sum of the tops over the sum of the bottoms, a day with nothing to
// measure has no value, and only a thing that was expected and did not happen is a zero, once the day is over.
import { describe, expect, test } from "vitest";
import { METRIC_IDS, METRIC_SHAPE, METRIC_VERSION, didSomething, houseHour, loggedOn, medianOf, periodOf, shareOf, valuesOfDay, type DayFacts, type DayRow, type EventRow, type MetricId } from "./metricRules";

const at = (iso: string) => Date.parse(iso);
const open: DayFacts = { openHabits: 0, hourOpen: false, finished: true };
const ev = (type: string, payload: Record<string, unknown> = {}, iso = "2026-10-20T12:00:00+05:30"): EventRow => ({ type, payload, occurredAt: at(iso) });

// One fixture for each measure: the events of a day, the facts, and the value expected. `null` means the measure has no value that day.
const FIXTURES: { id: MetricId; events: EventRow[]; facts?: DayFacts; expected: { num: number; den: number }; absent?: { events: EventRow[]; facts?: DayFacts } }[] = [
  { id: "E01", events: [ev("mood.logged", { mood: "happy" })], expected: { num: 1, den: 1 }, absent: { events: [ev("habits.ticked", { habit: "water" })] } },
  { id: "E02", events: [ev("mood.logged", { mood: "anxious" })], expected: { num: 1, den: 1 }, absent: { events: [] } },
  { id: "E03", events: [ev("mood.logged", { mood: "sad" })], expected: { num: 1, den: 1 } },
  { id: "E09", events: [ev("hour.felt", { feel: "okay", focus: 4, time: "evening", length: "under_40" }), ev("hour.felt", { feel: "drained", focus: 2, time: "night", length: "under_40" })], expected: { num: 1, den: 2 } },
  { id: "E10", events: [ev("hour.felt", { feel: "okay", focus: 4, time: "evening", length: "under_40" }), ev("hour.felt", { feel: "drained", focus: 2, time: "night", length: "under_40" })], expected: { num: 6, den: 2 } },
  { id: "E11", events: [ev("blog.published", { tag: "idea", words: 120, list: false })], expected: { num: 1, den: 1 } },
  { id: "H01", events: [ev("meals.logged", { meal: "breakfast", group: "grain", processing: "home_cooked" }, "2026-10-20T08:30:00+05:30")], expected: { num: 1, den: 1 } },
  { id: "H02", events: [ev("meals.logged", { meal: "lunch", group: "grain", processing: "home_cooked" }), ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" }), ev("meals.logged", { meal: "dinner", group: "grain", processing: "home_cooked" }, "2026-10-20T20:00:00+05:30")], expected: { num: 2, den: 5 } },
  { id: "H04", events: [ev("meals.logged", { meal: "dinner", group: "dal", processing: "home_cooked" }, "2026-10-20T22:30:00+05:30")], expected: { num: 1, den: 1 } },
  { id: "H05", events: [ev("meals.logged", { meal: "snack", group: "grain", processing: "packaged" }), ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" }), ev("meals.logged", { meal: "snack", group: "fruit" })], expected: { num: 1, den: 2 } },
  { id: "H06", events: [ev("sleep.logged", { bedMin: 660, lengthMin: 450 })], expected: { num: 660, den: 1 } },
  { id: "H07", events: [ev("sleep.logged", { bedMin: 660, lengthMin: 450 })], expected: { num: 450, den: 1 } },
  { id: "H08", events: [ev("habits.ticked", { habit: "water" }), ev("habits.ticked", { habit: "walk" })], expected: { num: 1, den: 1 } },
  { id: "H12", events: [ev("hour.present", { minutes: 25 })], expected: { num: 1, den: 1 } },
  { id: "X01", events: [ev("hour.present", { minutes: 25 }), ev("hour.present", { minutes: 10 })], expected: { num: 35, den: 1 } },
  { id: "A10", events: [ev("desk.mode", { turns: 2, active: 0 }), ev("desk.mode", { turns: 3, active: 1 })], expected: { num: 1, den: 1 }, absent: { events: [ev("desk.mode", { turns: 2, active: 0 })] } },
  { id: "A12", events: [ev("desk.mode", { turns: 2, active: 0 }), ev("desk.mode", { turns: 3, active: 1 })], expected: { num: 1, den: 2 } },
  { id: "X02", events: [ev("desk.present", { minutes: 12 }), ev("desk.present", { minutes: 8 })], expected: { num: 20, den: 1 } },
  { id: "A01", events: [ev("exams.submitted", { auto: false, mcqTried: 2, mcqRight: 1, longDone: 1, hints: 1 }), ev("exams.missed", {})], expected: { num: 1, den: 2 } },
  { id: "A02", events: [ev("exams.submitted", { auto: false, mcqTried: 4, mcqRight: 3, longDone: 0, hints: 0 })], expected: { num: 3, den: 4 } },
  { id: "A06", events: [ev("exams.submitted", { auto: false, mcqTried: 3, mcqRight: 3, longDone: 1, hints: 2 })], expected: { num: 2, den: 4 } },
  { id: "A15", events: [ev("modules.kept", { category: "academic" }), ev("modules.kept", { category: "life" })], expected: { num: 2, den: 1 } },
  { id: "C01", events: [ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" })], expected: { num: 1, den: 1 } },
  // The measures added in version 3.
  { id: "C02", events: [ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" }), ev("mood.logged", { mood: "happy" }), ev("mood.logged", { mood: "sad" }), ev("exams.missed", {})], expected: { num: 2, den: 1 } },
  { id: "E05", events: [ev("mood.logged", { mood: "sad" })], facts: { ...open, prevLightness: 5 }, expected: { num: 3, den: 1 }, absent: { events: [ev("mood.logged", { mood: "sad" })] } },
  { id: "E06L", events: [ev("mood.logged", { mood: "content" })], expected: { num: 1, den: 1 } },
  { id: "E06S", events: [ev("mood.logged", { mood: "tired" })], expected: { num: 1, den: 1 } },
  { id: "E06H", events: [ev("mood.logged", { mood: "heavy" })], expected: { num: 1, den: 1 } },
  { id: "E08", events: [ev("mood.logged", { mood: "happy", noteWords: 10 })], expected: { num: 1, den: 1 }, absent: { events: [ev("mood.logged", { mood: "happy" })] } },
  { id: "E12", events: [ev("blog.published", { tag: "idea", words: 100, list: false }), ev("blog.published", { tag: "study", words: 201, list: false })], expected: { num: 151, den: 1 } },
  { id: "E13", events: [ev("blog.published", { tag: "idea", words: 100, list: false, ttr: 700 }), ev("blog.published", { tag: "idea", words: 60, list: false, ttr: 500 })], expected: { num: 600, den: 1 }, absent: { events: [ev("blog.published", { tag: "idea", words: 20, list: false })] } },
  { id: "E14", events: [ev("blog.published", { tag: "idea", words: 100, list: true }), ev("blog.published", { tag: "idea", words: 100, list: false, paragraphs: true }), ev("blog.published", { tag: "idea", words: 100, list: false })], expected: { num: 2, den: 3 } },
  { id: "E15S", events: [ev("blog.published", { tag: "study", words: 10, list: false }), ev("blog.published", { tag: "idea", words: 10, list: false })], expected: { num: 1, den: 2 } },
  { id: "E15R", events: [ev("blog.published", { tag: "reflection", words: 10, list: false })], expected: { num: 1, den: 1 } },
  { id: "E15Q", events: [ev("blog.published", { tag: "question", words: 10, list: false })], expected: { num: 1, den: 1 } },
  { id: "E15I", events: [ev("blog.published", { tag: "idea", words: 10, list: false })], expected: { num: 1, den: 1 } },
  { id: "E16", events: [ev("blog.commented", {}), ev("blog.commented", {})], expected: { num: 2, den: 1 } },
  { id: "E16R", events: [ev("blog.replied", {})], expected: { num: 1, den: 1 } },
  { id: "H03B", events: [ev("meals.logged", { meal: "breakfast", group: "grain", processing: "home_cooked" }, "2026-10-20T08:00:00+05:30"), ev("meals.logged", { meal: "breakfast", group: "dal", processing: "home_cooked" }, "2026-10-20T09:00:00+05:30")], expected: { num: 510, den: 1 } },
  { id: "H03L", events: [ev("meals.logged", { meal: "lunch", group: "grain", processing: "home_cooked" }, "2026-10-20T13:00:00+05:30")], expected: { num: 780, den: 1 } },
  { id: "H03S", events: [ev("meals.logged", { meal: "snack", group: "fruit", processing: "home_cooked" }, "2026-10-20T17:30:00+05:30")], expected: { num: 1050, den: 1 } },
  { id: "H03D", events: [ev("meals.logged", { meal: "dinner", group: "dal", processing: "home_cooked" }, "2026-10-21T01:00:00+05:30")], expected: { num: 1500, den: 1 } },
  { id: "H11", events: [ev("hour.present", { minutes: 60, lateMinutes: 15 }), ev("hour.present", { minutes: 30, lateMinutes: 10 })], expected: { num: 25, den: 1 }, absent: { events: [ev("hour.present", { minutes: 60 })] } },
];

describe("one fixture for each measure (AC-1)", () => {
  test("covers AC-1: every measure in the catalog has a fixture, and its value is the one written beside it", () => {
    expect([...new Set(FIXTURES.map((f) => f.id))].sort()).toEqual([...METRIC_IDS].sort());
    for (const f of FIXTURES) {
      const v = valuesOfDay(f.events, f.facts ?? open)[f.id];
      expect(v, f.id).toEqual(f.expected);
    }
  });

  test("covers AC-2: a measure with nothing to measure has no value, never a zero", () => {
    for (const f of FIXTURES) {
      if (f.absent) expect(valuesOfDay(f.absent.events, f.absent.facts ?? open)[f.id], f.id).toBeUndefined();
    }
    expect(valuesOfDay([], open)).toEqual({});
    // A day of meals has no sleep, no mood, no habit and no paper values.
    const meal = valuesOfDay([ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" })], open);
    expect(Object.keys(meal).sort()).toEqual(["C01", "C02", "H01", "H02", "H03L", "H04", "H05"]);
    // A plate logged before the processing tag existed counts for the groups and not for the packaged share.
    expect(valuesOfDay([ev("meals.logged", { meal: "lunch", group: "dal" })], open).H05).toBeUndefined();
  });

  test("covers AC-2: a day that is not over has no zero for a habit or an hour that was open and not used, and a finished day has", () => {
    const facts = { openHabits: 2, hourOpen: true, finished: false };
    expect(valuesOfDay([], facts)).toEqual({});
    expect(valuesOfDay([], { ...facts, finished: true })).toEqual({ H08: { num: 0, den: 1 }, H12: { num: 0, den: 1 }, X01: { num: 0, den: 1 } });
    // With no habit open, a finished day has no habit value; a tick on a day still counts.
    expect(valuesOfDay([], { openHabits: 0, hourOpen: false, finished: true })).toEqual({});
    expect(valuesOfDay([ev("habits.ticked", { habit: "water" })], { openHabits: 0, hourOpen: false, finished: false }).H08).toEqual({ num: 1, den: 1 });
  });

  test("covers AC-1: a study room day is 20 minutes or more; mood codes fall in the families the Master Spec names", () => {
    expect(valuesOfDay([ev("hour.present", { minutes: 19 })], open).H12).toEqual({ num: 0, den: 1 });
    expect(valuesOfDay([ev("hour.present", { minutes: 20 })], open).H12).toEqual({ num: 1, den: 1 });
    for (const [mood, e2, e3] of [["stressed", 1, 0], ["anxious", 1, 0], ["sad", 0, 1], ["heavy", 0, 1], ["tired", 0, 0], ["happy", 0, 0], ["best", 0, 0], ["motivated", 0, 0], ["determined", 0, 0], ["content", 0, 0]] as const) {
      const v = valuesOfDay([ev("mood.logged", { mood })], open);
      expect([v.E02?.num, v.E03?.num], mood).toEqual([e2, e3]);
    }
  });

  test("covers AC-1: the house day's clock: breakfast before 11, a dinner after 22, and the small hours belong to the day before", () => {
    const meal = (iso: string, m: string) => valuesOfDay([ev("meals.logged", { meal: m, group: "grain", processing: "home_cooked" }, iso)], open);
    expect(meal("2026-10-20T10:59:00+05:30", "breakfast").H01).toEqual({ num: 1, den: 1 });
    expect(meal("2026-10-20T11:00:00+05:30", "breakfast").H01).toEqual({ num: 0, den: 1 });
    expect(meal("2026-10-20T21:59:00+05:30", "dinner").H04).toEqual({ num: 0, den: 1 });
    expect(meal("2026-10-20T22:00:00+05:30", "dinner").H04).toEqual({ num: 1, den: 1 });
    expect(meal("2026-10-21T00:30:00+05:30", "dinner").H04).toEqual({ num: 1, den: 1 });
    expect(houseHour(at("2026-10-21T01:00:00+05:30"))).toBe(25);
    expect(houseHour(at("2026-10-21T04:00:00+05:30"))).toBe(4);
  });
});

describe("the second formula (AC-4)", () => {
  test("covers AC-4: the formula is version 6", () => {
    expect(METRIC_VERSION).toBe(6);
  });

  test("covers AC-4: A10 is a desk study day only for a sitting of 3 questions, A12 is the share of sittings with an active kind, and neither is a logged day", () => {
    const few = valuesOfDay([ev("desk.mode", { turns: 2, active: 2 })], open);
    expect(few.A10).toBeUndefined();
    expect(few.A12).toEqual({ num: 1, den: 1 });
    const none = valuesOfDay([ev("desk.mode", { turns: 5, active: 0 })], open);
    expect(none.A10).toEqual({ num: 1, den: 1 });
    expect(none.A12).toEqual({ num: 0, den: 1 });
    for (const id of ["A10", "A12"] as const) expect(didSomething(id, { num: 1, den: 1 })).toBe(false);
    expect(loggedOn({ A10: { num: 1, den: 1 }, A12: { num: 1, den: 1 } })).toBe(false);
    expect(valuesOfDay([], open).A12).toBeUndefined();
  });

  test("covers AC-4: X02 adds the minutes at the desk, and desk time alone is not a logged day", () => {
    const v = valuesOfDay([ev("desk.present", { minutes: 12 }), ev("desk.present", { minutes: 8 })], open);
    expect(v.X02).toEqual({ num: 20, den: 1 });
    expect(didSomething("X02", { num: 20, den: 1 })).toBe(false);
    expect(loggedOn({ X02: { num: 20, den: 1 } })).toBe(false);
    expect(valuesOfDay([], open).X02).toBeUndefined();
  });

  test("covers AC-4: E09 and E10 read the desk's feeling card beside the study hour's", () => {
    const both = valuesOfDay([ev("hour.felt", { feel: "okay", focus: 4 }), ev("desk.felt", { feel: "drained", focus: 2 })], open);
    expect(both.E09).toEqual({ num: 1, den: 2 });
    expect(both.E10).toEqual({ num: 6, den: 2 });
    expect(valuesOfDay([ev("desk.felt", { feel: "energised", focus: 5 })], open).E10).toEqual({ num: 5, den: 1 });
  });

  test("covers AC-4: a missed paper alone is no meal, so it never sets C01", () => {
    expect(valuesOfDay([ev("exams.missed", {})], open).C01).toBeUndefined();
    expect(valuesOfDay([ev("meals.logged", { meal: "lunch", group: "dal", processing: "home_cooked" })], open).C01).toEqual({ num: 1, den: 1 });
  });

  test("covers AC-4: a comment received is not the student's doing: it is no log, no showing up and no room", () => {
    expect(valuesOfDay([ev("blog.replied", {})], open).C01).toBeUndefined();
    expect(valuesOfDay([ev("blog.replied", {})], open).C02).toBeUndefined();
    expect(didSomething("E16R", { num: 1, den: 1 })).toBe(false);
    expect(loggedOn({ E16R: { num: 1, den: 1 } })).toBe(false);
    expect(valuesOfDay([ev("blog.replied", {}), ev("mood.logged", { mood: "happy" })], open).C02).toEqual({ num: 1, den: 1 });
  });

  test("covers AC-4: the mood swing is the distance in lightness from the previous logged day, and none without one", () => {
    const swing = (mood: string, prev?: number) => valuesOfDay([ev("mood.logged", { mood })], { ...open, prevLightness: prev }).E05;
    expect(swing("best", 1)).toEqual({ num: 4, den: 1 });
    expect(swing("tired", 3)).toEqual({ num: 0, den: 1 });
    expect(swing("happy")).toBeUndefined();
  });

  test("covers AC-4: a real zero is not a log, and a tick, a sat hour, a sat paper or any other value is", () => {
    expect(didSomething("H08", { num: 0, den: 1 })).toBe(false);
    expect(didSomething("X01", { num: 0, den: 1 })).toBe(false);
    expect(didSomething("A01", { num: 0, den: 2 })).toBe(false);
    expect(didSomething("H08", { num: 1, den: 1 })).toBe(true);
    expect(didSomething("E01", { num: 1, den: 1 })).toBe(true);
    expect(didSomething("C01", { num: 1, den: 1 })).toBe(false);
    expect(loggedOn({ H08: { num: 0, den: 1 }, X01: { num: 0, den: 1 } })).toBe(false);
    expect(loggedOn({ H08: { num: 0, den: 1 }, E01: { num: 1, den: 1 } })).toBe(true);
  });
});

describe("periods (AC-3)", () => {
  const day = (d: string, events: EventRow[]): DayRow => ({ day: d, v: valuesOfDay(events, open) });

  test("covers AC-3: a week of accuracy is the sum of the tops over the sum of the bottoms, never an average of percentages", () => {
    const week = [
      day("2026-10-19", [ev("exams.submitted", { auto: false, mcqTried: 1, mcqRight: 1, longDone: 0, hints: 0 })]),
      day("2026-10-20", [ev("exams.submitted", { auto: false, mcqTried: 10, mcqRight: 1, longDone: 0, hints: 0 })]),
      day("2026-10-21", []),
    ];
    expect(periodOf(week, "A02")).toEqual({ num: 2, den: 11, logged: 2 });
    expect(shareOf(week, "A02")).toBeCloseTo(2 / 11, 10);
    expect(shareOf(week, "A02")).not.toBeCloseTo((1 + 0.1) / 2, 2);
  });

  test("covers AC-3: a period with nothing logged has no value and is not zero; the logged days are counted beside it", () => {
    const empty = [day("2026-10-19", []), day("2026-10-20", [])];
    expect(shareOf(empty, "E02")).toBeNull();
    expect(periodOf(empty, "E02")).toEqual({ num: 0, den: 0, logged: 0 });
    const mixed = [day("2026-10-19", [ev("mood.logged", { mood: "sad" })]), day("2026-10-20", [ev("mood.logged", { mood: "happy" })]), day("2026-10-21", [])];
    expect(periodOf(mixed, "E03")).toEqual({ num: 1, den: 2, logged: 2 });
  });

  test("covers AC-3: a clock measure's period value is the median of the days, and a length uses the same rule", () => {
    const nights = [660, 700, 640, 680].map((bed, i) => day(`2026-10-${19 + i}`, [ev("sleep.logged", { bedMin: bed, lengthMin: 450 })]));
    expect(medianOf(nights, "H06")).toBe(670);
    expect(medianOf(nights.slice(0, 3), "H06")).toBe(660);
    expect(medianOf([], "H06")).toBeNull();
    expect(METRIC_SHAPE.H06).toBe("clock");
  });
});
