import assert from "node:assert/strict";
import { test } from "node:test";
import { NEW_LINES } from "./sleep-words.ts";

// The copy rules (spec house/0008, AC-8): no word judges a night or sets a target, and no line is a label.
const BANNED = /\b(short|long|good|bad|enough|weak|bright|poor|great|target|should|too little|too much)\b/i;

test("no line of the sleep room judges a night, sets a target or labels a student", () => {
  for (const line of NEW_LINES) {
    // "Too many" and "too little" style refusals name the limit of the tool, not a night; only the judging words are refused here.
    const hit = line.match(BANNED);
    assert.equal(hit, null, `"${line}" has the word "${hit?.[0]}"`);
  }
});
