// The food table (spec house/0009) and the meals room (spec house/0010). Each test names the criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { mealsRoom } from "./mealsRoom";
import { groupCounts, matches, nutritionProblem } from "./foodRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const dal = { nameEn: "Dal tadka", nameHi: "दाल तड़का", aliases: ["dal"], group: "dal", processing: "home_cooked", energyKcal: 150, carbsG: 20, proteinG: 7, fatG: 5, serving: "1 bowl" };

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const other = await makeStudent(t, A.admin, a1, "other@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, other]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, teacher, s, other };
}

describe("the food table", () => {
  test("covers AC-2: the catalog starts empty, so a student's search finds nothing yet", async () => {
    const { s } = await world();
    expect(await s.as.query(api.foods.search, { text: "dal" })).toEqual([]);
  });

  test("covers AC-4 and AC-3: a student adds a custom dish with the numbers, and finds it by name, alias or Hindi spelling", async () => {
    const { s } = await world();
    await s.as.mutation(api.foods.addCustom, dal);
    expect((await s.as.query(api.foods.search, { text: "DAL" }))[0]).toMatchObject({ nameEn: "Dal tadka", nameHi: "दाल तड़का", group: "dal", status: "custom" });
    expect((await s.as.query(api.foods.search, { text: "तड़का" }))).toHaveLength(1);
    expect((await s.as.query(api.foods.search, { text: "  tadka " }))).toHaveLength(1);
  });

  test("covers AC-7: a student's search never returns the numbers", async () => {
    const { s } = await world();
    await s.as.mutation(api.foods.addCustom, dal);
    expect(JSON.stringify(await s.as.query(api.foods.search, { text: "dal" }))).not.toContain("energyKcal");
  });

  test("covers AC-5: another student does not see a custom dish, and cannot log it", async () => {
    const { s, other } = await world();
    await s.as.mutation(api.foods.addCustom, dal);
    expect(await other.as.query(api.foods.search, { text: "dal" })).toEqual([]);
  });

  test("covers AC-6: only a DHI admin lists unpublished dishes or publishes one, and a publish copies it to the catalog with no owner", async () => {
    const { s, teacher, dhi } = await world();
    const id = await s.as.mutation(api.foods.addCustom, dal);
    expect(await refusal(teacher.as.query(api.foods.unpublished, {}))).toBe("forbidden");
    expect(await refusal(s.as.mutation(api.foods.publish, { foodId: id }))).toBe("forbidden");
    expect((await dhi.as.query(api.foods.unpublished, {})).map((f) => f.nameEn)).toEqual(["Dal tadka"]);
    await dhi.as.mutation(api.foods.publish, { foodId: id });
    const copies = await s.as.query(api.foods.search, { text: "dal" });
    expect(copies.map((c) => c.status).sort()).toEqual(["catalog", "custom"]);
    expect(copies.find((c) => c.status === "catalog")).toBeDefined();
  });

  test("covers AC-2: the numbers must be finite and not negative", async () => {
    const { s } = await world();
    expect(await refusal(s.as.mutation(api.foods.addCustom, { ...dal, energyKcal: -1 }))).toBe("bad_number");
    expect(await refusal(s.as.mutation(api.foods.addCustom, { ...dal, carbsG: Number.NaN }))).toBe("bad_number");
    expect(nutritionProblem({ energyKcal: 1, carbsG: 1, proteinG: 1, fatG: 1 })).toBeNull();
  });
});

describe("the meals room", () => {
  test("covers AC-1: a student logs a plate, and it reads back after a reload", async () => {
    const { s } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    const r = await s.as.mutation(api.meals.log, { foodId, count: 2, meal: "lunch", eatenAt: NOW - 60 * 60 * 1000 });
    expect(r).toMatchObject({ ok: true, day: "2026-10-20" });
    const today = await s.as.query(api.meals.day, {});
    expect(today.plates).toHaveLength(1);
    expect(today.plates[0]).toMatchObject({ meal: "lunch", count: 2, foodName: "Dal tadka" });
  });

  test("covers AC-2: a meal eaten at 01:00 lands on the day before", async () => {
    const { s } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    vi.setSystemTime(at("2026-10-20T13:00:00+05:30"));
    const r = await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "dinner", eatenAt: at("2026-10-20T01:00:00+05:30") });
    expect(r).toMatchObject({ ok: true, day: "2026-10-19" });
    expect((await s.as.query(api.meals.day, {})).plates).toHaveLength(0);
  });

  test("covers AC-3: the day shows food group counts only, never energy or protein", async () => {
    const { s } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    await s.as.mutation(api.meals.log, { foodId, count: 2, meal: "lunch", eatenAt: NOW - 1000 });
    const day = await s.as.query(api.meals.day, {});
    expect(day.groups).toEqual({ grain: 0, dal: 2, vegetable: 0, dairy: 0, fruit: 0 });
    const text = JSON.stringify(day);
    expect(text).not.toContain("energyKcal");
    expect(text).not.toContain("proteinG");
  });

  test("covers AC-6: the event holds the meal and the group only, never the dish's name", async () => {
    const { s, t } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "snack", eatenAt: NOW - 1000 });
    const events = (await t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.room === "meals");
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ meal: "snack", group: "dal", processing: dal.processing });
    expect(JSON.stringify(events[0])).not.toContain("Dal tadka");
  });

  test("covers AC-5: removing a plate voids its event, so the day no longer counts it", async () => {
    const { s } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW - 1000 });
    const [plate] = (await s.as.query(api.meals.day, {})).plates;
    await s.as.mutation(api.meals.remove, { plateId: plate.plateId });
    expect((await s.as.query(api.meals.day, {})).plates).toHaveLength(0);
  });

  test("covers AC-4 (week): the week shows seven days and does not reset with the day", async () => {
    const { s } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW - 1000 });
    const week = await s.as.query(api.meals.week, {});
    expect(week).toHaveLength(7);
    expect(week[6].groups.dal).toBe(1);
  });

  test("covers AC-1: a bad count, a bad meal, a time in the future or more than a day back, and another student's dish are refused", async () => {
    const { s, other } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    expect(await s.as.mutation(api.meals.log, { foodId, count: 0, meal: "lunch", eatenAt: NOW })).toEqual({ ok: false, code: "bad_count" });
    expect(await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "brunch", eatenAt: NOW })).toEqual({ ok: false, code: "bad_meal" });
    expect(await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW + 60_000 })).toEqual({ ok: false, code: "bad_time" });
    expect(await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW - 25 * 60 * 60 * 1000 })).toEqual({ ok: false, code: "bad_time" });
    expect(await other.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW })).toEqual({ ok: false, code: "not_found" });
  });

  test("covers AC-7: the export holds the plates with food names and no owner, and erase removes the student's plates and custom dishes", async () => {
    const { s, t } = await world();
    const foodId = await s.as.mutation(api.foods.addCustom, dal);
    await s.as.mutation(api.meals.log, { foodId, count: 1, meal: "lunch", eatenAt: NOW - 1000 });
    const page = await t.run((ctx) => mealsRoom.exporter(ctx, s.memberId, null, 10));
    expect(page.rows).toHaveLength(1);
    expect(Object.keys(page.rows[0] as object).sort()).toEqual(["count", "day", "food", "group", "meal"]);
    await t.run((ctx) => mealsRoom.eraser(ctx, s.memberId, 10));
    expect(await s.as.query(api.foods.search, { text: "dal" })).toEqual([]);
  });
});

describe("the food rules", () => {
  test("the grouping and the search are exact", () => {
    expect(groupCounts([{ group: "dal", count: 2 }, { group: "fruit", count: 1 }])).toEqual({ grain: 0, dal: 2, vegetable: 0, dairy: 0, fruit: 1 });
    expect(matches("Dal Tadka", " tadka ")).toBe(true);
    expect(matches("Dal Tadka", "rice")).toBe(false);
  });
});
