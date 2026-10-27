// The study hour call's pure rules (house spec 0027).
import { describe, expect, test } from "vitest";
import { callIdOf } from "./hourCallRules";

describe("the study hour call id", () => {
  test("is short enough for Stream, the same every time, and different for each hour and institute", () => {
    const hour = "k5743ywqpyxe1dkdk4f9a0e6a17t3bxa";
    const a = "k177r5qfq1zrb6yvzgq55ba3x57t2hzn";
    const b = "k177r5qfq1zrb6yvzgq55ba3x57t2hzm";
    expect(callIdOf(hour, a).length).toBeLessThanOrEqual(64);
    expect(callIdOf(hour, a)).toMatch(/^[a-z0-9]+$/);
    expect(callIdOf(hour, a)).toBe(callIdOf(hour, a));
    expect(callIdOf(hour, a)).not.toBe(callIdOf(hour, b));
    expect(callIdOf(a, hour)).not.toBe(callIdOf(hour, a));
  });
});
