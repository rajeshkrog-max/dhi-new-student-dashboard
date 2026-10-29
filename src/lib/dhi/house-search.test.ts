import { test } from "node:test";
import assert from "node:assert/strict";
import { searchRooms } from "./house-search.ts";

const ROOMS = [
  { id: "home", label: "Home" },
  { id: "blog", label: "Blog" },
  { id: "papers", label: "Exams" },
  { id: "day", label: "Meal Tracker" },
  { id: "mood", label: "Mood Tracker" },
  { id: "habits", label: "Habit Tracker" },
  { id: "sleep", label: "Sleep" },
  { id: "modules", label: "Modules" },
  { id: "dhi", label: "DHI desk" },
  { id: "hour", label: "Study hour" },
  { id: "counsel", label: "Counseling" },
  { id: "progress", label: "Progress" },
  { id: "data", label: "Your data" },
];
const ids = (text: string) => searchRooms(ROOMS, text).map((r) => r.id);

test("a room's own name finds it first", () => {
  assert.equal(ids("sleep")[0], "sleep");
  assert.equal(ids("Mood")[0], "mood");
  assert.equal(ids("  exams ")[0], "papers");
});

test("everyday words and Hinglish find the room that holds them", () => {
  assert.equal(ids("roti")[0], "day");
  assert.equal(ids("doubt")[0], "dhi");
  assert.equal(ids("pariksha")[0], "papers");
  assert.equal(ids("neend")[0], "sleep");
  assert.equal(ids("erase")[0], "data");
  assert.equal(ids("video")[0], "modules");
});

test("a shared word lists every room that matches, best first and in menu order", () => {
  assert.deepEqual(ids("tracker"), ["day", "mood", "habits"]);
  assert.ok(ids("story").includes("blog") && ids("story").includes("dhi"));
});

test("empty text, only symbols and a word no room holds find nothing", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   "), []);
  assert.deepEqual(ids("?!"), []);
  assert.deepEqual(ids("zzqx"), []);
});
