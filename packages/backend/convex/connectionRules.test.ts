/// <reference types="vite/client" />
// The connections engine (house spec 0023): the fixed pairs, the 14 day minimum in each group, the bootstrap interval, the Benjamini Hochberg step and
// the food guard. Pure rules, so the days are made by hand.
import { describe, expect, test } from "vitest";
import { isHideable } from "./brainRules";
import { compare, connectionsOf, survivors, CONNECTION_PAIRS, CONNECTION_Q } from "./connectionRules";
import { shiftDay } from "./dayRules";
import type { DayRow, DayTags, DayValues } from "./metricRules";

const START = "2026-06-01";
const dayAt = (i: number) => shiftDay(START, i);
const one = (num: number, den = 1) => ({ num, den });

// `n` finished days from the start, each made by `make(i)`, plus an empty today.
function rowsOf(n: number, make: (i: number) => DayValues): { rows: DayRow[]; today: string } {
  const rows: DayRow[] = [];
  for (let i = 0; i < n; i += 1) rows.push({ day: dayAt(i), v: make(i) });
  return { rows, today: dayAt(n) };
}

// Sleep and papers: even days go to bed at 22:00 (600) and get 8 of 10 right, odd days at midnight (720) and get 3 of 10 right.
const sleepDays = (aDays: number, bDays: number, gap = 0.5): DayValues[] => {
  const out: DayValues[] = [];
  for (let i = 0; i < Math.max(aDays, bDays); i += 1) {
    if (i < aDays) out.push({ H06: one(600), A02: one(Math.round((0.5 + gap / 2) * 10), 10) });
    if (i < bDays) out.push({ H06: one(720), A02: one(Math.round((0.5 - gap / 2) * 10), 10) });
  }
  return out;
};
const fromList = (list: DayValues[]) => rowsOf(list.length, (i) => list[i]);

describe("the statistics", () => {
  test("the same days give the same answer every time", () => {
    const a = [0.9, 0.8, 0.85, 0.95, 0.9, 0.8, 0.85, 0.9, 0.95, 0.8, 0.9, 0.85, 0.9, 0.95, 0.8];
    const b = [0.4, 0.5, 0.45, 0.4, 0.35, 0.5, 0.45, 0.4, 0.5, 0.45, 0.4, 0.35, 0.5, 0.45, 0.4];
    expect(compare("x", a, b)).toEqual(compare("x", a, b));
  });

  test("a clear gap has an interval that leaves out 0 and a small p value; two equal groups do not", () => {
    const a = [0.9, 0.8, 0.85, 0.95, 0.9, 0.8, 0.85, 0.9, 0.95, 0.8, 0.9, 0.85, 0.9, 0.95, 0.8];
    const b = [0.4, 0.5, 0.45, 0.4, 0.35, 0.5, 0.45, 0.4, 0.5, 0.45, 0.4, 0.35, 0.5, 0.45, 0.4];
    const clear = compare("x", a, b);
    expect(clear.lo).toBeGreaterThan(0);
    expect(clear.p).toBeLessThan(0.01);
    const same = compare("x", a, [...a].reverse());
    expect(same.lo).toBeLessThanOrEqual(0);
    expect(same.hi).toBeGreaterThanOrEqual(0);
    expect(same.p).toBeGreaterThan(0.5);
  });

  test("Benjamini Hochberg over six pairs at q 0.1 keeps a very small p and drops a borderline one", () => {
    expect(survivors(new Map([["a", 0.001], ["b", 0.5]]), CONNECTION_PAIRS, CONNECTION_Q)).toEqual(new Set(["a"]));
    expect(survivors(new Map([["a", 0.02]]), CONNECTION_PAIRS, CONNECTION_Q)).toEqual(new Set());
    expect(survivors(new Map([["a", 0.016]]), CONNECTION_PAIRS, CONNECTION_Q)).toEqual(new Set(["a"]));
    expect(survivors(new Map([["a", 0.001], ["b", 0.03]]), CONNECTION_PAIRS, CONNECTION_Q)).toEqual(new Set(["a", "b"]));
  });
});

describe("the fixed pairs", () => {
  test("P1: paper accuracy after an early bedtime against a late one, from 14 days in each group", () => {
    const { rows, today } = fromList(sleepDays(15, 15));
    const hits = connectionsOf(rows, today);
    expect(hits).toEqual([{ id: "sleep_papers", a: 80, b: 30, nA: 15, nB: 15 }]);
  });

  test("nothing is compared with fewer than 14 days in a group", () => {
    const { rows, today } = fromList(sleepDays(13, 15));
    expect(connectionsOf(rows, today)).toEqual([]);
    const other = fromList(sleepDays(15, 13));
    expect(connectionsOf(other.rows, other.today)).toEqual([]);
  });

  test("no real difference shows nothing", () => {
    const { rows, today } = fromList(sleepDays(20, 20, 0));
    expect(connectionsOf(rows, today)).toEqual([]);
  });

  test("today is never read, and a bedtime exactly at 23:30 is the later group", () => {
    const list = sleepDays(15, 15);
    const { rows, today } = fromList(list);
    const withToday: DayRow[] = [...rows, { day: today, v: { H06: one(600), A02: one(10, 10) } }];
    expect(connectionsOf(withToday, today)).toEqual(connectionsOf(rows, today));
    const edge = fromList(Array.from({ length: 30 }, (_, i) => ({ H06: one(690), A02: one(i % 2 === 0 ? 9 : 4, 10) })));
    expect(connectionsOf(edge.rows, edge.today)).toEqual([]);
  });

  test("P3: a light mood on more days after an early bedtime", () => {
    const list: DayValues[] = [];
    for (let i = 0; i < 16; i += 1) {
      // A real mood day holds all three bands, the chosen one at 1 and the others at 0 (metricRules.valuesOfDay; review of 2026-10-26).
      list.push({ H06: one(600), E06L: one(1), E06S: one(0), E06H: one(0) });
      list.push({ H06: one(720), E06L: one(0), E06S: one(0), E06H: one(1) });
    }
    const { rows, today } = fromList(list);
    expect(connectionsOf(rows, today)).toEqual([{ id: "bedtime_mood", a: 100, b: 0, nA: 16, nB: 16 }]);
  });

  test("P2 and the food guard: better focus on a day with breakfast is shown, better focus without it never is", () => {
    const make = (focusWith: number, focusWithout: number) => {
      const list: DayValues[] = [];
      for (let i = 0; i < 16; i += 1) {
        list.push({ H03B: one(480), E10: one(focusWith, 1) });
        list.push({ H03L: one(780), E10: one(focusWithout, 1) });
      }
      return fromList(list);
    };
    const shown = make(4.5, 2.5);
    expect(connectionsOf(shown.rows, shown.today)).toEqual([{ id: "breakfast_focus", a: 4.5, b: 2.5, nA: 16, nB: 16 }]);
    const guarded = make(2.5, 4.5);
    expect(connectionsOf(guarded.rows, guarded.today)).toEqual([]);
  });

  test("P2: a breakfast at 11:00 or later is in neither group", () => {
    const list: DayValues[] = [];
    for (let i = 0; i < 16; i += 1) {
      list.push({ H03B: one(480), E10: one(4, 1) });
      list.push({ H03B: one(660), E10: one(1, 1) });
    }
    const { rows, today } = fromList(list);
    expect(connectionsOf(rows, today)).toEqual([]);
  });

  test("P5: a late study room day and how the next day's session felt", () => {
    const list: DayValues[] = [];
    for (let i = 0; i < 15; i += 1) {
      list.push({ H11: one(45) });
      list.push({ E09: one(0, 1) });
      list.push({ H11: one(0) });
      list.push({ E09: one(1, 1) });
    }
    const { rows, today } = fromList(list);
    expect(connectionsOf(rows, today)).toEqual([{ id: "late_room_feeling", a: 0, b: 100, nA: 15, nB: 15 }]);
  });
});

// Tagged days (house spec 0028): `n` finished days, each with its measures and its tags.
function taggedOf(list: DayTags[]): { rows: DayRow[]; today: string } {
  return { rows: list.map((t, i) => ({ day: dayAt(i), v: { C01: one(1) }, t })), today: dayAt(list.length) };
}

describe("the tagged pairs (house spec 0028)", () => {
  test("P4: paper answers on a topic the day after a desk sitting on it, against topics with no sitting the day before", () => {
    const list: DayTags[] = [];
    for (let i = 0; i < 15; i += 1) {
      list.push({ "d:t1": one(1) });
      list.push({ "p:t1": one(8, 10), "p:t2": one(3, 10) });
    }
    const { rows, today } = taggedOf(list);
    expect(connectionsOf(rows, today)).toEqual([{ id: "topic_desk_papers", a: 80, b: 30, nA: 15, nB: 15 }]);
  });

  test("P4: a sitting on another topic, or two days before, puts the paper in the group with no sitting", () => {
    const list: DayTags[] = [];
    for (let i = 0; i < 15; i += 1) {
      list.push({ "d:t9": one(1) });
      list.push({});
      list.push({ "p:t1": one(8, 10) });
    }
    const { rows, today } = taggedOf(list);
    expect(connectionsOf(rows, today)).toEqual([]); // 15 papers, all in group B, none in A
  });

  test("P4: nothing is compared with 13 topic days on one side", () => {
    const list: DayTags[] = [];
    for (let i = 0; i < 13; i += 1) list.push({ "d:t1": one(1) }, { "p:t1": one(9, 10) });
    for (let i = 0; i < 20; i += 1) list.push({ "p:t2": one(2, 10) });
    const { rows, today } = taggedOf(list);
    expect(connectionsOf(rows, today)).toEqual([]);
  });

  test("P6: the subject whose sessions were drained more often, against the student's other subjects, with the subject named", () => {
    const list: DayTags[] = [];
    for (let i = 0; i < 12; i += 1) list.push({ "s:maths": one(1, 1), "s:english": one(0, 1) });
    const { rows, today } = taggedOf(list);
    expect(connectionsOf(rows, today)).toEqual([{ id: "subject_feeling", subject: "maths", a: 100, b: 0, nA: 12, nB: 12 }]);
  });

  test("P6: fewer than 10 sessions on a side shows nothing; a subject with no difference shows nothing", () => {
    const few: DayTags[] = [];
    for (let i = 0; i < 9; i += 1) few.push({ "s:maths": one(1, 1), "s:english": one(0, 1) });
    expect(connectionsOf(taggedOf(few).rows, taggedOf(few).today)).toEqual([]);
    const even: DayTags[] = [];
    for (let i = 0; i < 20; i += 1) even.push({ "s:maths": one(i % 2, 1), "s:english": one((i + 1) % 2, 1) });
    expect(connectionsOf(taggedOf(even).rows, taggedOf(even).today)).toEqual([]);
  });

  test("P6: the p value of the best subject is multiplied by the subjects tried, so a borderline gap does not survive", () => {
    // Maths drained on 6 of 10 sessions, the others on 2 of 10: a gap that one test might pass, but not after the correction for the subjects tried.
    const list: DayTags[] = [];
    for (let i = 0; i < 10; i += 1) list.push({ "s:maths": one(i < 6 ? 1 : 0, 1), "s:science": one(i < 1 ? 1 : 0, 1), "s:english": one(i < 1 ? 1 : 0, 1) });
    const { rows, today } = taggedOf(list);
    const single = compare("subject_feeling:maths", [1, 1, 1, 1, 1, 1, 0, 0, 0, 0], Array.from({ length: 20 }, (_, i) => (i < 2 ? 1 : 0)));
    expect(single.p).toBeLessThan(0.05);
    expect(connectionsOf(rows, today)).toEqual([]);
  });

  test("P4 and P6: today is never read", () => {
    const list: DayTags[] = [];
    for (let i = 0; i < 12; i += 1) list.push({ "s:maths": one(1, 1), "s:english": one(0, 1) });
    const { rows } = taggedOf(list);
    expect(connectionsOf(rows, dayAt(5))).toEqual([]);
  });
});

describe("hiding a connection", () => {
  test("every connection can be hidden for 30 days like a pattern", () => {
    for (const id of ["sleep_papers", "breakfast_focus", "bedtime_mood", "late_room_feeling", "topic_desk_papers", "subject_feeling"]) expect(isHideable(id)).toBe(true);
    expect(isHideable("nope")).toBe(false);
  });
});
