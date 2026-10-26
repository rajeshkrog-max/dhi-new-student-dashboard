/// <reference types="vite/client" />
// Who may reach the sleep room, the meals room and the food table (house specs 0008, 0009, 0010). The mood and habits rooms have their own refusal
// tests; these three had only a teacher's refusal. Every public function here is the signed in student's own: a student at the gate, one who
// withdrew, a removed student, a student of a paused institute, every staff role and a signed out caller are refused, and a student of another
// institute never sees a row of this one's.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const dal = { nameEn: "Dal tadka", group: "dal", processing: "home_cooked", energyKcal: 150, carbsG: 20, proteinG: 7, fatG: 5, serving: "1 bowl" };

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const other = await makeStudent(t, B.admin, b1, "o@beta.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  const foodId = await s.as.mutation(api.foods.addCustom, dal);
  return { t, dhi, A, B, a1, teacher, s, other, counselor, foodId };
}
type World = Awaited<ReturnType<typeof world>>;

// Every student function of the three rooms, as one caller. The ids are real, so a refusal is about the caller and never about a bad argument.
function calls(w: World, plateId: Id<"mealPlates">) {
  return {
    "sleep.save": (p: Person) => p.as.mutation(api.sleep.save, { bedMin: 1380, lengthMin: 480 }),
    "sleep.recent": (p: Person) => p.as.query(api.sleep.recent, {}),
    "meals.log": (p: Person) => p.as.mutation(api.meals.log, { foodId: w.foodId, count: 1, meal: "lunch", eatenAt: Date.now() - 60_000 }),
    "meals.day": (p: Person) => p.as.query(api.meals.day, {}),
    "meals.week": (p: Person) => p.as.query(api.meals.week, {}),
    "meals.remove": (p: Person) => p.as.mutation(api.meals.remove, { plateId }),
    "foods.search": (p: Person) => p.as.query(api.foods.search, { text: "dal" }),
    "foods.addCustom": (p: Person) => p.as.mutation(api.foods.addCustom, { ...dal, nameEn: "Rajma" }),
  };
}

async function aPlate(w: World): Promise<Id<"mealPlates">> {
  const r = (await w.s.as.mutation(api.meals.log, { foodId: w.foodId, count: 1, meal: "lunch", eatenAt: Date.now() - 60_000 })) as { ok: boolean };
  expect(r.ok).toBe(true);
  return await w.t.run(async (ctx) => (await ctx.db.query("mealPlates").take(1))[0]._id);
}

describe("the sleep and meals rooms and the food table are the student's own", () => {
  test("every staff role is refused with forbidden, and a signed out caller with not_signed_in", async () => {
    const w = await world();
    const plateId = await aPlate(w);
    for (const [name, call] of Object.entries(calls(w, plateId))) {
      for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) expect(await refusal(call(p)), `${name} as staff`).toBe("forbidden");
      expect(await refusal(call({ as: w.t } as unknown as Person)), `${name} signed out`).toBe("not_signed_in");
    }
  });

  test("a student at the gate, one who withdrew, a removed one and one of a paused institute are refused by every function", async () => {
    const w = await world();
    const plateId = await aPlate(w);
    const gate = await makeStudent(w.t, w.A.admin, w.a1, "gate@alpha.test", false, { consent: false });
    const left = await makeStudent(w.t, w.A.admin, w.a1, "left@alpha.test", false);
    const removed = await makeStudent(w.t, w.A.admin, w.a1, "removed@alpha.test", false);
    await left.as.mutation(api.consent.withdraw, {});
    await w.A.admin.as.mutation(api.members.remove, { memberId: removed.memberId });
    for (const [name, call] of Object.entries(calls(w, plateId))) {
      expect(await refusal(call(gate)), `${name} at the gate`).toBe("consent_required");
      expect(await refusal(call(left)), `${name} withdrawn`).toBe("consent_withdrawn");
      expect(await refusal(call(removed)), `${name} removed`).toBe("removed");
    }
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, status: "suspended" });
    for (const [name, call] of Object.entries(calls(w, plateId))) expect(await refusal(call(w.other)), `${name} paused institute`).toBe("institute_suspended");
  });

  test("a student of another institute sees none of this student's nights, plates or dishes, and cannot remove a plate", async () => {
    const w = await world();
    const plateId = await aPlate(w);
    await w.s.as.mutation(api.sleep.save, { bedMin: 1380, lengthMin: 480 });
    expect(JSON.stringify(await w.other.as.query(api.sleep.recent, {}))).not.toContain("1380");
    expect(JSON.stringify(await w.other.as.query(api.meals.day, {}))).not.toContain(w.foodId);
    expect(JSON.stringify(await w.other.as.query(api.meals.week, {}))).not.toContain(w.foodId);
    expect(JSON.stringify(await w.other.as.query(api.foods.search, { text: "dal" }))).not.toContain(w.foodId);
    expect(await refusal(w.other.as.mutation(api.meals.log, { foodId: w.foodId, count: 1, meal: "lunch", eatenAt: Date.now() - 60_000 }))).not.toBe("ok");
    expect(await refusal(w.other.as.mutation(api.meals.remove, { plateId }))).not.toBe("ok");
    expect(await w.t.run(async (ctx) => (await ctx.db.get(plateId)) !== null)).toBe(true);
  });
});
