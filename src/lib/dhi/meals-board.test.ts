import assert from "node:assert/strict";
import { test } from "node:test";
import { KITCHEN_TIPS, lampOrder, plateLine, topDishes, usualTime } from "./meals-board.ts";

const at = (iso: string) => Date.parse(iso);
const plate = (meal: string, iso: string, foodName = "Roti", count = 1) => ({
  meal,
  group: "grain",
  count,
  foodName,
  eatenAt: at(iso),
});
const zero = { grain: 0, dal: 0, vegetable: 0, dairy: 0, fruit: 0 };

test("meals board: the usual time is the middle time of the days, one per day", () => {
  const days = [
    {
      plates: [
        plate("breakfast", "2026-10-18T08:00:00+05:30"),
        plate("breakfast", "2026-10-18T10:30:00+05:30"),
      ],
    },
    { plates: [plate("breakfast", "2026-10-19T08:30:00+05:30")] },
    { plates: [plate("breakfast", "2026-10-20T11:00:00+05:30")] },
    { plates: [] },
  ];
  assert.equal(usualTime(days, "breakfast"), "8:30 am");
  assert.equal(usualTime(days, "dinner"), null);
  assert.equal(
    usualTime(
      [
        { plates: [plate("dinner", "2026-10-18T20:00:00+05:30")] },
        { plates: [plate("dinner", "2026-10-19T21:00:00+05:30")] },
      ],
      "dinner",
    ),
    "8:30 pm",
  );
});

test("meals board: dishes are counted over the week, most first", () => {
  const days = [
    {
      plates: [
        plate("lunch", "2026-10-18T13:00:00+05:30", "Dal", 1),
        plate("lunch", "2026-10-18T13:00:00+05:30", "Roti", 3),
      ],
    },
    { plates: [plate("dinner", "2026-10-19T20:00:00+05:30", "Dal", 1)] },
  ];
  assert.deepEqual(topDishes(days), [
    { name: "Roti", times: 3 },
    { name: "Dal", times: 2 },
  ]);
});

test("meals board: the plate line states facts and never judges", () => {
  assert.equal(plateLine(zero), "No plate yet today. Log when you have eaten.");
  assert.equal(
    plateLine({ grain: 2, dal: 1, vegetable: 1, dairy: 1, fruit: 1 }),
    "Every food group has come to the plate today.",
  );
  assert.equal(
    plateLine({ ...zero, grain: 2, dal: 1 }),
    "Not on the plate yet today: vegetable, dairy, fruit.",
  );
  for (const line of [
    plateLine(zero),
    plateLine({ ...zero, grain: 1 }),
    ...Object.values(KITCHEN_TIPS).flatMap((t) => [t.title, t.body]),
  ]) {
    assert.ok(
      !/\b(good|bad|healthy|unhealthy|junk|calorie|kcal|target|should|must)\b/i.test(line),
      `a judging or counting word: ${line}`,
    );
  }
});

test("meals board: the lamp starts with the group that came least this week", () => {
  const week = [
    { ...zero, grain: 3, dal: 1, vegetable: 2, dairy: 1 },
    { ...zero, grain: 2, dal: 1, dairy: 1 },
  ];
  assert.deepEqual(
    lampOrder(week),
    ["fruit", "dal", "vegetable", "dairy", "grain"],
    "ties keep the group order",
  );
});
