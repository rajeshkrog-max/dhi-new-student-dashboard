// The pure rules of the school report (house spec 0025). Each test names the criterion it covers.
import { describe, expect, test } from "vitest";
import { bandOf, MIN_STUDENTS, rangeProblem, reportOf, weekOf, type Attempt, type Question } from "./schoolRules";

const Q: Question[] = [
  { order: 0, kind: "mcq", subject: "Maths", topic: "Fractions", rightOption: 1 },
  { order: 1, kind: "mcq", subject: "Science", topic: "Cells", rightOption: 0 },
  { order: 2, kind: "long", subject: "English", topic: "Story" },
];
const papers = (ids: string[]) => new Map(ids.map((id) => [id, Q]));
const mondays = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];

// One handed in attempt; `right` says which of the two multiple choice questions were right.
function sat(memberId: string, paperId: string, day: string, right: [boolean, boolean]): Attempt {
  return {
    memberId,
    paperId,
    day,
    dueAt: Date.parse(`${day}T12:00:00Z`),
    closed: true,
    status: "submitted",
    missed: false,
    excused: false,
    answers: [
      { question: 0, choice: right[0] ? 1 : 0 },
      { question: 1, choice: right[1] ? 0 : 2 },
      { question: 2 },
    ],
  };
}
const missed = (memberId: string, paperId: string, day: string, excused = false): Attempt => ({
  ...sat(memberId, paperId, day, [false, false]),
  missed: !excused,
  excused,
  answers: [],
});
const students = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

describe("the school report rules", () => {
  test("covers AC-3: a week starts on Monday, and a range is at most 13 weeks", () => {
    expect(weekOf("2026-10-21")).toBe("2026-10-19");
    expect(weekOf("2026-10-19")).toBe("2026-10-19");
    expect(weekOf("2026-10-25")).toBe("2026-10-19");
    expect(new Date(`${weekOf("2026-11-01")}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(rangeProblem("2026-10-01", "2026-12-30")).toBeNull();
    expect(rangeProblem("2026-10-01", "2026-12-31")).toBe("too_long");
    expect(rangeProblem("2026-10-10", "2026-10-01")).toBe("bad_range");
  });

  test("covers AC-3: papers, sat on time, missed and excused are counted over closed attempts only", () => {
    const rows = [sat("a", "p1", mondays[0], [true, true]), missed("b", "p1", mondays[0]), missed("c", "p1", mondays[0], true), { ...sat("d", "p2", mondays[1], [true, true]), closed: false, status: "assigned" }];
    const r = reportOf(rows, papers(["p1", "p2"]));
    expect(r).toMatchObject({ papers: 2, closed: 3, sat: 1, missed: 1, excused: 1 });
  });

  test(`covers AC-4: a share shows only when ${MIN_STUDENTS} or more students tried it`, () => {
    const few = reportOf(students(MIN_STUDENTS - 1).map((s) => sat(s, "p1", mondays[0], [true, false])), papers(["p1"]));
    expect(few.subjects.find((x) => x.subject === "Maths")).toMatchObject({ students: MIN_STUDENTS - 1, pct: null });
    const enough = reportOf(students(MIN_STUDENTS).map((s, i) => sat(s, "p1", mondays[0], [i < 3, false])), papers(["p1"]));
    expect(enough.subjects.find((x) => x.subject === "Maths")).toMatchObject({ students: MIN_STUDENTS, pct: 60 });
    expect(enough.subjects.find((x) => x.subject === "Science")).toMatchObject({ pct: 0 });
    // A long answer never makes a subject row of its own.
    expect(enough.subjects.map((x) => x.subject)).toEqual(["Maths", "Science"]);
  });

  test("covers AC-4: the heat map bands are peach under 50, gold 50 to 64, mint 65 and up", () => {
    expect([bandOf(0), bandOf(49), bandOf(50), bandOf(64), bandOf(65), bandOf(100)]).toEqual(["low", "low", "mid", "mid", "high", "high"]);
    const r = reportOf(students(6).map((s, i) => sat(s, "p1", mondays[0], [i < 4, false])), papers(["p1"]));
    expect(r.topics.find((x) => x.topic === "Fractions")?.cells).toEqual([{ week: mondays[0], students: 6, pct: 67, band: "high" }]);
  });

  test("covers AC-4: a subject's change is its last shown week less its first", () => {
    const rows = [
      ...students(5).map((s, i) => sat(s, "p1", mondays[0], [i < 2, false])),
      ...students(5).map((s, i) => sat(s, "p2", mondays[2], [i < 4, false])),
    ];
    expect(reportOf(rows, papers(["p1", "p2"])).subjects.find((x) => x.subject === "Maths")?.change).toBe(40);
  });

  test("covers AC-5: CR1 says re-teach a topic under 50% that rose less than 5 points over the last three weeks", () => {
    const flat = [0, 1, 2].flatMap((w) => students(6).map((s, i) => sat(s, `p${w}`, mondays[w], [i < 2, true])));
    const r = reportOf(flat, papers(["p0", "p1", "p2"]));
    expect(r.actions).toEqual([{ kind: "reteach", subject: "Maths", topic: "Fractions", pct: 33, gain: 0 }]);
    // Science is right for everyone, so it is never an action.
    const rising = [0, 1, 2].flatMap((w) => students(6).map((s, i) => sat(s, `p${w}`, mondays[w], [i < w + 1, true])));
    expect(reportOf(rising, papers(["p0", "p1", "p2"])).actions).toEqual([]);
  });

  test("covers AC-5: CR1 needs two shown weeks", () => {
    const one = students(6).map((s) => sat(s, "p0", mondays[0], [false, true]));
    expect(reportOf(one, papers(["p0"])).actions).toEqual([]);
  });

  test("covers AC-6: two closed papers missed in a row put a student on the list; an excused one between is skipped", () => {
    const rows = [missed("a", "p0", mondays[0]), missed("a", "p1", mondays[1]), missed("b", "p0", mondays[0]), sat("b", "p1", mondays[1], [true, true]), missed("b", "p2", mondays[2])];
    const c = [missed("c", "p0", mondays[0]), missed("c", "p1", mondays[1], true), missed("c", "p2", mondays[2])];
    const r = reportOf([...rows, ...c], papers(["p0", "p1", "p2"]));
    expect(r.support).toEqual([
      { memberId: "a", reasons: ["missed_in_a_row"] },
      { memberId: "c", reasons: ["missed_in_a_row"] },
    ]);
  });

  test("covers AC-6: a share lower than the week before, two weeks running, puts a student on the list; with a gap week it does not", () => {
    const down = [sat("a", "p0", mondays[0], [true, true]), sat("a", "p1", mondays[1], [true, false]), sat("a", "p2", mondays[2], [false, false])];
    expect(reportOf(down, papers(["p0", "p1", "p2"])).support).toEqual([{ memberId: "a", reasons: ["accuracy_down"] }]);
    const gap = [sat("a", "p0", mondays[0], [true, true]), sat("a", "p1", mondays[1], [true, false]), sat("a", "p3", mondays[3], [false, false]), sat("b", "p2", mondays[2], [true, true])];
    expect(reportOf(gap, papers(["p0", "p1", "p2", "p3"])).support).toEqual([]);
  });

  test("covers AC-6: the list carries reasons only, never a share, a mark or an order by need", () => {
    const r = reportOf([missed("a", "p0", mondays[0]), missed("a", "p1", mondays[1])], papers(["p0", "p1"]));
    expect(Object.keys(r.support[0]).sort()).toEqual(["memberId", "reasons"]);
  });

  test("uses no clock: the same rows give the same report", () => {
    const rows = students(6).map((s) => sat(s, "p0", mondays[0], [true, false]));
    expect(JSON.stringify(reportOf(rows, papers(["p0"])))).toBe(JSON.stringify(reportOf(rows, papers(["p0"]))));
  });
});
