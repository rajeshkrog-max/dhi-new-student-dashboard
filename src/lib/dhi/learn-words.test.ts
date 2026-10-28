import assert from "node:assert/strict";
import { test } from "node:test";
import { LEARN_LINES, STEP_WORDS, learnRefusal } from "./learn-words.ts";

// The copy rules of the desk's Learn panel (house spec 0031): no word labels or ranks a student, and a topic's step never names a level of ability.
const BANNED = /\b(weak|average|bright|dull|stupid|silly|slow|clever|smart|rank|ranked|best|worst|foundation|stretch|level)\b/i;

test("no line of the Learn panel labels or ranks a student", () => {
  for (const line of LEARN_LINES) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("every step the server sends has words", () => {
  for (const step of ["new", "practising", "held"]) assert.ok(STEP_WORDS[step], step);
});

test("a refusal code the server sends reads as plain words", () => {
  for (const code of ["no_questions", "nothing_to_fix", "nothing_due", "exam_open", "bad_day"]) assert.notEqual(learnRefusal(code), code);
});
