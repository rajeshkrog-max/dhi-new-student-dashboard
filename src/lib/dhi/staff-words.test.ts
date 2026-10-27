import assert from "node:assert/strict";
import { test } from "node:test";
import { STAFF_WORDS } from "./staff-words.ts";

// The copy rules (spec house/0026): no word labels or ranks a student, and counts read singular and plural.
const BANNED = /\b(weak|average|bright|dull|slow|clever|smart|rank|ranked|best|worst|top|bottom|failing|struggling|at risk|lazy)\b/i;
function lines(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String((value as (...a: unknown[]) => string)(1, 2)), String((value as (...a: unknown[]) => string)(2, 3))];
  if (value && typeof value === "object") return Object.values(value).flatMap(lines);
  return [];
}

test("no line of the staff houses labels or ranks a student", () => {
  for (const line of lines(STAFF_WORDS)) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("counts read singular and plural", () => {
  assert.equal(STAFF_WORDS.teacher.toMark(1), "1 sitting to mark");
  assert.equal(STAFF_WORDS.teacher.toMark(3), "3 sittings to mark");
  assert.equal(STAFF_WORDS.dhi.deskToday(1), "1 desk question reached the model today");
  assert.equal(STAFF_WORDS.openTimes(0), "0 times open");
});

test("the overview and the roster say what they never show", () => {
  assert.match(STAFF_WORDS.overviewIntro, /No names/);
  assert.match(STAFF_WORDS.counselorsIntro, /never their sessions or students/);
  assert.match(STAFF_WORDS.studentLook, /Answers are never shown/);
});
