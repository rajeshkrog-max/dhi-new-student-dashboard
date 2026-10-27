import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR_CALL_WORDS } from "./hour-call-words.ts";

// The copy rules (spec house/0027): no word labels or ranks a student, and the notice says the call is recorded and who may watch, before anyone joins.
const BANNED = /\b(weak|average|bright|dull|slow|clever|smart|rank|ranked|best|worst|top|bottom|failing|lazy)\b/i;
const lines = Object.values(HOUR_CALL_WORDS).flatMap((w) => (typeof w === "string" ? [w] : typeof w === "function" ? [w(1), w(2)] : []));

test("no line of the study hour call labels or ranks a student", () => {
  for (const line of lines) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("the notice says the call is recorded, who may watch, for how long, and that only the school's students are in it", () => {
  assert.match(HOUR_CALL_WORDS.recordedNotice, /recorded/);
  assert.match(HOUR_CALL_WORDS.recordedNotice, /teachers and the DHI team/);
  assert.match(HOUR_CALL_WORDS.recordedNotice, /30 days/);
  assert.match(HOUR_CALL_WORDS.recordedNotice, /Only students of your school/);
  assert.match(HOUR_CALL_WORDS.intro, /start off/);
});

test("the staff page says each look is seen by the students", () => {
  assert.match(HOUR_CALL_WORDS.staffIntro, /see it in Your data/);
  assert.equal(HOUR_CALL_WORDS.seated(1), "1 student seated");
  assert.equal(HOUR_CALL_WORDS.seated(3), "3 students seated");
});
