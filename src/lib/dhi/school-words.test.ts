import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHOOL_WORDS } from "./school-words.ts";

// The copy rules (spec house/0025): no word labels or ranks a student, and the report says where its numbers come from.
const BANNED = /\b(weak|average|bright|dull|slow|clever|smart|rank|ranked|best|worst|top|bottom|failing|struggling|at risk|lazy)\b/i;
const lines = Object.values(SCHOOL_WORDS).flatMap((w) =>
  typeof w === "string" ? [w] : typeof w === "function" ? [String((w as (...a: unknown[]) => string)(1, 2, 3, 4))] : Object.values(w),
);

test("no line of the school report labels or ranks a student", () => {
  for (const line of lines) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("the report says it comes from papers only, and the list says it is not a ranking", () => {
  assert.match(SCHOOL_WORDS.intro, /papers/);
  assert.match(SCHOOL_WORDS.intro, /mood, sleep, meals, habits, desk or Progress/);
  assert.match(SCHOOL_WORDS.supportAbout, /not a ranking/);
});

test("every support reason and every room has words", () => {
  for (const r of ["missed_in_a_row", "accuracy_down"]) assert.ok(SCHOOL_WORDS.reasons[r]);
  for (const k of ["mood", "meals", "habits", "sleep", "hour", "modules"]) assert.ok(SCHOOL_WORDS.rooms[k]);
});

test("the re-teach line reads up, down and singular points", () => {
  assert.equal(SCHOOL_WORDS.reteach("Fractions", "Maths", 40, 3), "Re-teach Fractions (Maths). 40% right over the last weeks, up 3 points.");
  assert.equal(SCHOOL_WORDS.reteach("Cells", "Science", 30, -1), "Re-teach Cells (Science). 30% right over the last weeks, down 1 point.");
});
