import assert from "node:assert/strict";
import { test } from "node:test";
import { GUNAS, MOOD_CODES } from "@dhi/backend/moodRules";
import { MOODS, THOUGHTS, contrast, inkOn } from "./mood-demo.ts";
import { GUNA_WORDS, MOOD_WORDS_APPROVED, NEW_LINES, dhiLine, gunaOf, moodRefusal } from "./mood-words.ts";

// Clinical words the room must not use, and labels it must not put on a student (spec house/0006, AC-8).
const CLINICAL = /\b(depress\w*|disorder\w*|diagnos\w*|therap\w*|medicat\w*|treatment|illness|patholog\w*|clinical|psychiatr\w*|suicid\w*|syndrome|symptom\w*)\b/i;
const LABELS = /\b(weak|average|bright|dull|lazy|backward|stupid|slow learner|low performer)\b/i;

test("spec house/0006 AC-8: the screen's moods are exactly the server's mood codes", () => {
  assert.deepEqual(MOODS.map((m) => m.key).sort(), [...MOOD_CODES].sort());
  assert.deepEqual(Object.keys(THOUGHTS).sort(), [...MOOD_CODES].sort());
});

test("spec house/0006 AC-8: every mood has a guna with a line and a tip, and the three gunas all have words", () => {
  for (const mood of MOOD_CODES) assert.ok(GUNAS.includes(gunaOf(mood)), mood);
  assert.deepEqual(Object.keys(GUNA_WORDS).sort(), [...GUNAS].sort());
  for (const g of GUNAS) {
    assert.ok(GUNA_WORDS[g].line.length > 20 && GUNA_WORDS[g].tip.length > 20, g);
  }
});

test("spec house/0006 AC-8: no clinical word and no label anywhere in the new lines, and no clinical word in the DHI lines", () => {
  for (const line of NEW_LINES) {
    assert.ok(!CLINICAL.test(line), `clinical word in: ${line}`);
    assert.ok(!LABELS.test(line), `label in: ${line}`);
  }
  for (const [mood, bank] of Object.entries(THOUGHTS)) for (const line of bank) assert.ok(!CLINICAL.test(line), `clinical word in ${mood}: ${line}`);
});

test("spec house/0006 AC-8: each mood has two DHI lines, the stored index picks one, and a day never gets a line for another mood", () => {
  for (const mood of MOOD_CODES) {
    assert.equal(THOUGHTS[mood].length, 2, mood);
    assert.equal(dhiLine(mood, 0), THOUGHTS[mood][0]);
    assert.equal(dhiLine(mood, 1), THOUGHTS[mood][1]);
    assert.equal(dhiLine(mood, 2), THOUGHTS[mood][0]);
  }
});

test("spec house/0006 AC-8: the new words are marked as drafts until the owner approves them", () => {
  assert.equal(MOOD_WORDS_APPROVED, false);
});

test("spec house/0006 AC-11: every refusal of a save has plain words, and an unknown one falls back to the house's words", () => {
  for (const code of ["bad_mood", "note_too_long", "too_many_changes", "rate_limited", "day_full", "consent_required", "consent_withdrawn"]) {
    assert.ok(moodRefusal(code).length > 10, code);
    assert.ok(!moodRefusal(code).includes("Something went wrong"), code);
  }
  assert.equal(moodRefusal("nothing_like_this"), "Something went wrong. Please try again.");
  assert.equal(moodRefusal({ data: { code: "rate_limited" } }), moodRefusal("rate_limited"));
});

// WCAG 2.1 AA 1.4.3 (the accessibility scan of 2026-10-26): the label on every mood's own colour reaches 4.5 to 1.
test("every mood's label on its own colour reaches a contrast of 4.5 to 1", () => {
  const hexOf: Record<string, string> = { "text-paper": "#f6f1e8", "text-home": "#2a2438", "text-ink": "#122018", "text-white": "#ffffff" }; // look-ok: token values
  for (const m of MOODS) {
    const { ink } = inkOn(m.color);
    assert.ok(contrast(m.color, hexOf[ink]) >= 4.5, `${m.key} on ${m.color} with ${ink}`);
  }
});
