import assert from "node:assert/strict";
import { test } from "node:test";
import { COUNSEL_WORDS, shownStatus } from "./counsel-words.ts";

// The copy rules (spec house/0024): no word labels or ranks a student, the recording is said before anyone joins, and help is always named.
const BANNED = /\b(weak|average|bright|dull|stupid|slow|clever|smart|rank|ranked|best|worst|disorder|diagnos\w*|patient)\b/i;
const lines = Object.values(COUNSEL_WORDS).flatMap((w) => (typeof w === "string" ? [w] : typeof w === "function" ? [w(1), w(2)] : Object.values(w)));

test("no line of counseling labels or ranks a student, or names an illness", () => {
  for (const line of lines) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("the notice says the call is recorded and transcribed, and who does not see it", () => {
  assert.match(COUNSEL_WORDS.recordedNotice, /recorded/);
  assert.match(COUNSEL_WORDS.recordedNotice, /transcript/);
  assert.match(COUNSEL_WORDS.recordedNotice, /school.*teachers.*parents/);
});

test("the room names a helpline, and an empty list points to a trusted adult", () => {
  assert.match(COUNSEL_WORDS.helpline, /14416/);
  assert.match(COUNSEL_WORDS.noFree, /parent|teacher|grown up/i);
});

test("a booked session reads as ended once its call has closed, and every status has words", () => {
  const close = 30 * 60 * 1000;
  assert.equal(shownStatus("booked", 1000, 1000 + close, close), "Booked");
  assert.equal(shownStatus("booked", 1000, 1001 + close, close), "Ended");
  assert.equal(shownStatus("done", 1000, 10 ** 12, close), "Done");
  for (const s of ["booked", "cancelled_by_student", "cancelled_by_counselor", "done"]) assert.notEqual(shownStatus(s, 0, 0, close), s);
});

test("share words are singular and plural", () => {
  assert.equal(COUNSEL_WORDS.sharedWith(1), "Shared with 1 person.");
  assert.equal(COUNSEL_WORDS.sharedWith(2), "Shared with 2 people.");
});
