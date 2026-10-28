/// <reference types="vite/client" />
// The one minute job (house spec 0029): with nothing to do it starts nothing; each frequent job is started only when its own check finds work; the
// rebuild of stale Brain days is asked every tenth minute. The jobs themselves are tested in their own files.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
// 10:01, so the tenth minute check is off unless a test moves the clock.
const NOW = at("2026-10-20T10:01:00+05:30");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  await t.run(async (ctx) => {
    await ctx.db.patch(s.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s };
}
type W = Awaited<ReturnType<typeof world>>;
const tick = (w: W) => w.t.mutation(internal.minuteTick.tick, {});
// The rollup's own pass, so the events written by a test's setup do not show as Brain work in a later check.
const settleBrain = async (w: W) => {
  vi.setSystemTime(Date.now() + 11 * 1000);
  await w.t.mutation(internal.brainRollup.run, {});
  vi.setSystemTime(Date.now() + 2 * MIN);
  await w.t.mutation(internal.brainRollup.run, {});
};

describe("the minute tick", () => {
  test("an idle deployment starts nothing", async () => {
    const w = await world();
    expect(await tick(w)).toEqual([]);
  });

  test("a new event starts the Brain's pass, and once it is read the tick is idle again", async () => {
    const w = await world();
    await w.s.as.mutation(api.moods.save, { mood: "happy", note: "" });
    vi.setSystemTime(Date.now() + 11 * 1000);
    expect(await tick(w)).toEqual(["brainValues"]);
    await settleBrain(w);
    expect(await tick(w)).toEqual([]);
  });

  test("an open seat starts the study hour sweep", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + HOUR });
    await w.s.as.mutation(api.studyHour.enter, { mode: "live" });
    expect(await tick(w)).toContain("studySeats");
  });

  test("a paper whose window has closed starts the exam sweep", async () => {
    const w = await world();
    const mcq = { kind: "mcq" as const, subject: "maths", topic: "Fractions", text: "Half of four?", options: ["one", "two"], rightOption: 1, tags: [null, null] };
    const paperId = await w.teacher.as.mutation(api.papers.create, { title: "Check", questions: [mcq] });
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: NOW - HOUR, dueAt: NOW + 5 * MIN });
    expect(await tick(w)).not.toContain("examSittings");
    vi.setSystemTime(NOW + 6 * MIN);
    expect(await tick(w)).toContain("examSittings");
  });

  test("an idle desk sitting and a question left waiting start their jobs", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      await ctx.db.insert("deskSittings", { memberId: w.s.memberId, instituteId: m!.instituteId!, startedAt: NOW - 40 * MIN, lastAt: NOW - 20 * MIN });
    });
    expect(await tick(w)).toEqual(["deskSittings"]);
    await w.t.mutation(internal.deskSitting.closeSittings, {});
    expect(await tick(w)).toEqual([]);
  });

  test("days under an older formula are asked for only on the tenth minute", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      await ctx.db.insert("brainDays", { memberId: w.s.memberId, instituteId: m!.instituteId!, day: "2026-10-19", values: {}, version: 1, computedAt: NOW });
    });
    expect(await tick(w)).toEqual([]);
    vi.setSystemTime(at("2026-10-20T10:10:00+05:30"));
    expect(await tick(w)).toEqual(["brainRebuild"]);
  });

  test("days a pass cannot rebuild (a student who withdrew) are asked for again a day later, not every tenth minute", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      await ctx.db.insert("brainDays", { memberId: w.s.memberId, instituteId: m!.instituteId!, day: "2026-10-19", values: {}, version: 1, computedAt: NOW });
      await ctx.db.patch(w.s.memberId, { status: "removed" });
    });
    vi.setSystemTime(at("2026-10-20T10:10:00+05:30"));
    expect(await tick(w)).toContain("brainRebuild");
    await w.t.mutation(internal.brainRollup.rebuildStale, {});
    expect((await w.t.run((ctx) => ctx.db.query("brainDays").collect()))[0].version).toBe(1); // still stale: it cannot be rebuilt
    vi.setSystemTime(at("2026-10-20T10:20:00+05:30"));
    expect(await tick(w)).not.toContain("brainRebuild");
    vi.setSystemTime(at("2026-10-21T10:20:00+05:30"));
    expect(await tick(w)).toContain("brainRebuild");
  });

  test("the minute job is the only cron that runs every minute", () => {
    const files = import.meta.glob("./crons.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const minuteJobs = (files["./crons.ts"].match(/\{ minutes: 1 \}[^\n]*/g) ?? []).map((l) => l.trim());
    expect(minuteJobs).toEqual(["{ minutes: 1 }, internal.minuteTick.tick, {});"]);
  });
});
