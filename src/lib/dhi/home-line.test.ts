import assert from "node:assert/strict";
import { test } from "node:test";
import { QUIET_LINE, homeLine } from "./home-line.ts";

const NOW = Date.parse("2026-10-20T12:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const none = { now: NOW, openPapers: [], unreadMarks: [], hour: null, recallsDue: 0 };

test("home line: nothing waiting gives the quiet line", () => {
  assert.equal(homeLine(none), QUIET_LINE);
});

test("home line: the open paper closing first comes before everything else", () => {
  const line = homeLine({
    ...none,
    openPapers: [
      { title: "Maths", dueAt: NOW + 5 * HOUR },
      { title: "Biology", dueAt: NOW + 2 * HOUR },
    ],
    unreadMarks: ["Physics"],
    recallsDue: 3,
  });
  assert.equal(line, "Biology is open until 2:00 pm. Sit when you can be quiet.");
});

test("home line: a paper whose window has passed is not offered", () => {
  assert.equal(
    homeLine({ ...none, openPapers: [{ title: "Old", dueAt: NOW - HOUR }] }),
    QUIET_LINE,
  );
});

test("home line: a mark to read, then an open hour, then recalls, then an hour later today", () => {
  assert.equal(
    homeLine({ ...none, unreadMarks: ["Physics"], recallsDue: 2 }),
    "Your mark for Physics is ready. Read the remarks when you can.",
  );
  assert.equal(
    homeLine({ ...none, hour: { opensAt: NOW - HOUR, closesAt: NOW + HOUR }, recallsDue: 2 }),
    "The study hour is open now. Your seat is waiting.",
  );
  assert.equal(homeLine({ ...none, recallsDue: 1 }), "One recall waits on the DHI desk.");
  assert.equal(homeLine({ ...none, recallsDue: 4 }), "4 recalls wait on the DHI desk.");
  assert.equal(
    homeLine({ ...none, hour: { opensAt: NOW + 5 * HOUR, closesAt: NOW + 6 * HOUR } }),
    "The study hour opens at 5:00 pm today.",
  );
  assert.equal(
    homeLine({ ...none, hour: { opensAt: NOW + 24 * HOUR, closesAt: NOW + 25 * HOUR } }),
    QUIET_LINE,
    "an hour tomorrow is left for the calendar",
  );
});
