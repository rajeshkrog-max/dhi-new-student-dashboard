import assert from "node:assert/strict";
import { test } from "node:test";
import { dayLabel, joinExport } from "./your-data.ts";

test("spec house/0005 AC-11: a day shows as an India date with no time of day", () => {
  assert.equal(dayLabel("2026-10-19"), "19 Oct 2026");
  assert.equal(dayLabel("2028-02-29"), "29 Feb 2028");
  assert.equal(dayLabel("not a day"), "not a day");
});

test("spec house/0005 AC-12: the pages join into the one file the spec names, holding nothing else", () => {
  const file = joinExport("dhi-house-export-v1", 123, [
    { section: "header", rows: [{ profile: { name: "A" }, consent: [{ kind: "self" }], sharing: { parentLevel: "none" } }] },
    { section: "events", rows: [{ type: "t", day: "2026-10-19", id: "1" }] },
    { section: "events", rows: [{ type: "t", day: "2026-10-19", id: "2" }] },
    { section: "meals", rows: [{ x: 1 }] },
    { section: "meals", rows: [{ x: 2 }] },
  ]);
  assert.deepEqual(Object.keys(file).sort(), ["consent", "events", "exportedAt", "funnel", "profile", "rooms", "schema", "sharing"]);
  assert.equal(file.funnel, null);
  assert.equal(file.events.length, 2);
  assert.deepEqual(file.rooms, { meals: [{ x: 1 }, { x: 2 }] });
  assert.deepEqual(file.sharing, { parentLevel: "none" });
});

test("spec house/0005 AC-12: an empty export is still a whole file", () => {
  const file = joinExport("dhi-house-export-v1", 1, []);
  assert.deepEqual(file, { schema: "dhi-house-export-v1", exportedAt: 1, profile: null, consent: [], sharing: null, funnel: null, events: [], rooms: {} });
});

test("spec house/0002 funnel link: a linked student's own DhiRise answers reach the file", () => {
  const funnel = { linkedAt: 5, profile: { name: "A" }, checks: [{ completedAt: 6, answers: [{ q: 1, optionId: "q1o2", answeredAt: 7 }] }] };
  const file = joinExport("dhi-house-export-v1", 1, [{ section: "header", rows: [{ profile: { name: "A" }, consent: [], sharing: null, funnel }] }]);
  assert.deepEqual(file.funnel, funnel);
});
