// The day rule (spec house/0004): the edges of the 04:00 boundary, month ends, year ends, 29 February, and that the file is pure.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { BOUNDARY_HOUR, dayBounds, dayOf, DAY_MS, isDayKey, isLate, MAX_AGE_DAYS, shiftDay, todayOf } from "./dayRules";

const at = (iso: string) => Date.parse(iso);

describe("the 04:00 to 04:00 India day (AC-2, AC-3)", () => {
  test("covers AC-2: 03:59:59.999 belongs to the earlier day and 04:00:00.000 to the next", () => {
    expect(dayOf(at("2026-10-19T03:59:59.999+05:30"))).toBe("2026-10-18");
    expect(dayOf(at("2026-10-19T04:00:00.000+05:30"))).toBe("2026-10-19");
  });

  test("covers AC-2: 01:00 counts for the day before, and noon for its own day", () => {
    expect(dayOf(at("2026-10-19T01:00:00+05:30"))).toBe("2026-10-18");
    expect(dayOf(at("2026-10-19T12:00:00+05:30"))).toBe("2026-10-19");
    expect(dayOf(at("2026-10-19T23:59:59.999+05:30"))).toBe("2026-10-19");
  });

  test("covers AC-2: a month end, a year end and 29 February give the right day", () => {
    expect(dayOf(at("2026-11-01T03:00:00+05:30"))).toBe("2026-10-31");
    expect(dayOf(at("2026-11-01T04:00:00+05:30"))).toBe("2026-11-01");
    expect(dayOf(at("2027-01-01T02:30:00+05:30"))).toBe("2026-12-31");
    expect(dayOf(at("2027-01-01T04:00:00+05:30"))).toBe("2027-01-01");
    expect(dayOf(at("2028-03-01T03:59:59.999+05:30"))).toBe("2028-02-29");
    expect(dayOf(at("2028-02-29T10:00:00+05:30"))).toBe("2028-02-29");
    expect(dayOf(at("2027-03-01T03:59:59.999+05:30"))).toBe("2027-02-28");
  });

  test("covers AC-2: the answer does not depend on the machine's own time zone, only on the moment", () => {
    // The same moment written in UTC and in India time lands on the same day.
    expect(dayOf(at("2026-10-18T22:29:59.999Z"))).toBe("2026-10-18");
    expect(dayOf(at("2026-10-18T22:30:00.000Z"))).toBe("2026-10-19");
  });

  test("covers AC-3: todayOf is dayOf for a clock the caller read", () => {
    const now = at("2026-10-19T02:00:00+05:30");
    expect(todayOf(now)).toBe(dayOf(now));
    expect(todayOf(now)).toBe("2026-10-18");
  });

  test("covers AC-2: dayBounds holds exactly one day, 24 hours from 04:00", () => {
    const { start, end } = dayBounds("2026-10-19");
    expect(start).toBe(at("2026-10-19T04:00:00+05:30"));
    expect(end - start).toBe(DAY_MS);
    expect(dayOf(start)).toBe("2026-10-19");
    expect(dayOf(start - 1)).toBe("2026-10-18");
    expect(dayOf(end - 1)).toBe("2026-10-19");
    expect(dayOf(end)).toBe("2026-10-20");
  });

  test("covers AC-2: dayOf and dayBounds agree on every day across a leap year", () => {
    let day = "2028-01-01";
    for (let i = 0; i < 366; i++) {
      const { start, end } = dayBounds(day);
      expect(dayOf(start)).toBe(day);
      expect(dayOf(end - 1)).toBe(day);
      expect(dayOf(end)).toBe(shiftDay(day, 1));
      day = shiftDay(day, 1);
    }
    expect(day).toBe("2029-01-01");
  });
});

describe("day keys (AC-5)", () => {
  test("covers AC-5: isDayKey accepts real days only", () => {
    expect(isDayKey("2026-10-19")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true);
    for (const bad of ["2027-02-29", "2026-13-01", "2026-00-10", "2026-10-00", "2026-10-32", "2026-4-5", "26-10-19", "2026/10/19", "2026-10-19T00:00", " 2026-10-19", "1999-12-31", "", "today"]) {
      expect(isDayKey(bad), bad).toBe(false);
    }
    for (const bad of [null, undefined, 20261019, {}, ["2026-10-19"]]) expect(isDayKey(bad)).toBe(false);
  });

  test("covers AC-6: shiftDay crosses month ends, year ends and 29 February both ways", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2028-02-29", 1)).toBe("2028-03-01");
    expect(shiftDay("2027-03-01", -1)).toBe("2027-02-28");
    expect(shiftDay("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftDay("2026-10-19", -MAX_AGE_DAYS)).toBe("2026-10-12");
    expect(shiftDay("2026-10-19", 0)).toBe("2026-10-19");
  });

  test("covers AC-5: bad input throws instead of guessing", () => {
    expect(() => shiftDay("2026-02-30", 1)).toThrow();
    expect(() => shiftDay("2026-10-19", 1.5)).toThrow();
    expect(() => dayBounds("nope")).toThrow();
    expect(() => dayOf(Number.NaN)).toThrow();
    expect(() => dayOf(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("late (AC-6)", () => {
  test("covers AC-6: written on a later day than it counts for is late, and on the same day is not", () => {
    const now = at("2026-10-19T09:00:00+05:30");
    expect(isLate("2026-10-19", now)).toBe(false);
    expect(isLate("2026-10-18", now)).toBe(true);
    // 02:00 on the 19th is still the 18th, so a thing for the 18th is on time.
    expect(isLate("2026-10-18", at("2026-10-19T02:00:00+05:30"))).toBe(false);
  });

  test("covers AC-6: the constants are the ones the spec names", () => {
    expect(BOUNDARY_HOUR).toBe(4);
    expect(MAX_AGE_DAYS).toBe(7);
  });
});

describe("the file is pure (AC-13)", () => {
  const source = readFileSync(new URL("./dayRules.ts", import.meta.url), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  test("covers AC-13: it imports nothing and reads no clock, database or environment", () => {
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/Date\.now|new Date\(\s*\)|performance\.now|process\.|ctx\.|Math\.random/);
  });
});
