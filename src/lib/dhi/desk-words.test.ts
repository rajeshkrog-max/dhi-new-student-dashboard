import assert from "node:assert/strict";
import { test } from "node:test";
import { CARE_TEXT, COINS_SPENT, NEW_LINES } from "./desk-words.ts";

// The copy rules (spec house/0016): no word labels or ranks a student or calls a question silly, and the care text points to people.
const BANNED =
  /\b(weak|average|bright|dull|stupid|silly|slow|clever|smart|rank|ranked|best|worst)\b/i;

test("no line of the desk labels or ranks a student", () => {
  for (const line of NEW_LINES) {
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});

test("the care text points to a trusted adult and a helpline, and does not counsel", () => {
  assert.match(CARE_TEXT, /parent|teacher|grown up/i);
  assert.match(CARE_TEXT, /14416/);
});

test("coin words are singular and plural", () => {
  assert.equal(COINS_SPENT(1), "1 coin");
  assert.equal(COINS_SPENT(0), "0 coins");
});
