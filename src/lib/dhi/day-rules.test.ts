import assert from "node:assert/strict";
import { test } from "node:test";
// The house reads the day rule from the shared backend package, the same file the server uses (spec house/0004, AC-13).
import { BOUNDARY_HOUR, dayOf, isDayKey, shiftDay, todayOf } from "@dhi/backend/dayRules";

test("spec house/0004 AC-13: the screens import the one day rule, and a meal at 01:00 counts for the day before", () => {
  assert.equal(BOUNDARY_HOUR, 4);
  assert.equal(dayOf(Date.parse("2026-10-19T01:00:00+05:30")), "2026-10-18");
  assert.equal(dayOf(Date.parse("2026-10-19T04:00:00+05:30")), "2026-10-19");
  assert.equal(todayOf(Date.parse("2026-10-19T03:59:59.999+05:30")), "2026-10-18");
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
  assert.equal(isDayKey("2027-02-29"), false);
});
