import assert from "node:assert/strict";
import { test } from "node:test";
import { initialsOf } from "./initials.ts";

test("spec 0008: the badge takes the first letters of the first and last word, in capitals", () => {
  assert.equal(initialsOf("Verify Student"), "VS");
  assert.equal(initialsOf("asha rao"), "AR");
  assert.equal(initialsOf("Asha Devi Rao"), "AR", "middle names are skipped");
});

test("spec 0008: a single word gives one letter, and extra spaces change nothing", () => {
  assert.equal(initialsOf("Asha"), "A");
  assert.equal(initialsOf("  Asha   Rao  "), "AR");
});

test("spec 0008: a name with no letters or no text still gives something to draw", () => {
  assert.equal(initialsOf(""), "·");
  assert.equal(initialsOf("   "), "·");
});

test("spec 0008: a letter outside the basic alphabet is kept whole, not cut in half", () => {
  assert.equal(initialsOf("Ágata Çelik"), "ÁÇ");
  assert.equal(initialsOf("𠮷田 Rao").length, 3, "one astral letter is two code units but one letter");
});
