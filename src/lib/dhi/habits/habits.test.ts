import assert from "node:assert/strict";
import { test } from "node:test";
import { HABIT_COLORS, HABIT_KINDS, MAX_OPEN_HABITS } from "@dhi/backend/habitCodes";
import { CATALOG } from "./catalog.ts";
import { MAX_HABITS, PALETTE } from "./schema.ts";
import { NEW_LINES, habitRefusal, HABIT_WORDS_APPROVED } from "./words.ts";
import { addDays, currentStreak, finishedPlans, longestStreak, openPlans, runningPlans, storeFromServer, tally, todayKey } from "./store.ts";

const CLINICAL = /\b(depress\w*|disorder\w*|diagnos\w*|therap\w*|medicat\w*|treatment|illness|patholog\w*|clinical|psychiatr\w*|suicid\w*|syndrome|symptom\w*)\b/i;
const LABELS = /\b(weak|average|bright|dull|lazy|backward|stupid|slow learner|low performer)\b/i;

test("spec house/0007 AC-12: the screen's catalog ids and colours are exactly the server's kinds and colours", () => {
  assert.deepEqual([...CATALOG.map((c) => c.id), "custom"].sort(), [...HABIT_KINDS].sort());
  assert.deepEqual(PALETTE.map((p) => p.hex).sort(), [...HABIT_COLORS].sort());
  assert.equal(MAX_HABITS, MAX_OPEN_HABITS);
  for (const c of CATALOG) assert.ok((HABIT_COLORS as readonly string[]).includes(c.color), c.id);
});

test("spec house/0007 AC-12: the new words carry no clinical word and no label, and are marked as drafts", () => {
  for (const line of NEW_LINES) {
    assert.ok(!CLINICAL.test(line), line);
    assert.ok(!LABELS.test(line), line);
  }
  assert.equal(HABIT_WORDS_APPROVED, false);
});

test("spec house/0007 AC-12: every refusal of a habit call has plain words, and an unknown one falls back to the house's words", () => {
  for (const code of ["bad_title", "bad_habit", "bad_color", "bad_window", "too_many_habits", "too_many_adds", "too_many_flips", "not_open", "not_found", "rate_limited", "day_full"]) {
    assert.ok(habitRefusal(code).length > 10 && !habitRefusal(code).includes("Something went wrong"), code);
  }
  assert.equal(habitRefusal("nothing"), "Something went wrong. Please try again.");
  assert.equal(habitRefusal({ data: { code: "not_open" } }), habitRefusal("not_open"));
});

test("spec house/0007 AC-4: a miss is a day with no tick, streaks come from the ticks, and a habit that starts later is open but not running", () => {
  const today = todayKey();
  const store = storeFromServer([
    { id: "a", kind: "water", title: "Water", color: HABIT_COLORS[3], startOn: addDays(today, -5), endOn: addDays(today, 10), ticks: [addDays(today, -4), addDays(today, -3), addDays(today, -1), today] },
    { id: "b", kind: "custom", title: "Later", color: HABIT_COLORS[0], startOn: addDays(today, 3), endOn: addDays(today, 20), ticks: [] },
    { id: "c", kind: "walk", title: "Done", color: HABIT_COLORS[1], startOn: addDays(today, -30), endOn: addDays(today, -2), ticks: [addDays(today, -30)] },
  ]);
  assert.equal(store.plans[1].catalogId, null);
  assert.deepEqual(openPlans(store).map((p) => p.id), ["a", "b"]);
  assert.deepEqual(runningPlans(store).map((p) => p.id), ["a"]);
  assert.deepEqual(finishedPlans(store).map((p) => p.id), ["c"]);
  const plan = store.plans[0];
  assert.equal(currentStreak(store, plan), 2); // today and yesterday
  assert.equal(longestStreak(store, plan), 2);
  const t = tally(store, plan);
  assert.equal(t.lit, 4);
  assert.equal(t.miss, 2); // the first day and the day before yesterday had no tick
});
