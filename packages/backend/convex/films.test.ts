// The modules room (spec house/0013). Each test names the criterion it covers. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { filmRoom } from "./filmRoom";
import { FINISH_TOLERANCE_SEC, hostRefProblem, progressAfter, reachedEnd, uploadProblem } from "./moduleRules";
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

const check = { question: "What is the leaf's kitchen?", options: ["Root", "Chloroplast", "Stem"], rightOption: 1 };
const selfHelp = { title: "One quiet breath", category: "self_help", blurb: "Stay until the end.", cover: "/mood/thought.jpg", hostRef: "/landing/night.mp4", durationSec: 20, scoreValue: 10, checks: [] as (typeof check)[] };
const academic = { ...selfHelp, title: "The leaf kitchen", category: "academic", checks: [check, check] };

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
  return { t, dhi, A, teacher, s };
}

async function approved(w: Awaited<ReturnType<typeof world>>, film = selfHelp) {
  const filmId = await w.dhi.as.mutation(api.films.upload, film);
  await w.dhi.as.mutation(api.films.approve, { filmId });
  return filmId;
}

describe("the modules room", () => {
  test("covers AC-1: a DHI admin uploads a film, and it stays hidden from students until approved", async () => {
    const w = await world();
    const filmId = await w.dhi.as.mutation(api.films.upload, selfHelp);
    expect((await w.s.as.query(api.films.list, {})).films).toEqual([]);
    expect((await w.dhi.as.query(api.films.pending, {})).map((f) => f.title)).toEqual(["One quiet breath"]);
    await w.dhi.as.mutation(api.films.approve, { filmId });
    const list = await w.s.as.query(api.films.list, {});
    expect(list.films).toHaveLength(1);
    expect(list.films[0]).toMatchObject({ title: "One quiet breath", kept: false, ratio: 0, scoreValue: 10 });
  });

  test("covers AC-2: a student, a teacher and an institute admin cannot upload or approve a film", async () => {
    const w = await world();
    const filmId = await w.dhi.as.mutation(api.films.upload, selfHelp);
    for (const who of [w.s, w.teacher, w.A.admin]) {
      expect(await refusal(who.as.mutation(api.films.upload, selfHelp))).toBe("forbidden");
      expect(await refusal(who.as.mutation(api.films.approve, { filmId }))).toBe("forbidden");
    }
  });

  test("covers AC-6: an academic film carries exactly two check questions, and approval is refused without them", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.films.upload, { ...academic, checks: [check] }))).toBe("bad_check");
    expect(await refusal(w.dhi.as.mutation(api.films.upload, { ...selfHelp, checks: [check] }))).toBe("bad_check");
    const filmId = await w.dhi.as.mutation(api.films.upload, academic);
    await w.t.run(async (ctx) => {
      const rows = await ctx.db.query("filmChecks").withIndex("by_filmId", (q) => q.eq("filmId", filmId)).collect();
      await ctx.db.delete(rows[0]._id);
    });
    expect(await refusal(w.dhi.as.mutation(api.films.approve, { filmId }))).toBe("bad_check");
  });

  test("covers AC-7: the host reference and the cover must be safe paths, and the list never carries the host reference or a right option", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.films.upload, { ...selfHelp, hostRef: "https://evil.example/x.mp4" }))).toBe("bad_host_ref");
    expect(await refusal(w.dhi.as.mutation(api.films.upload, { ...selfHelp, hostRef: "/../secret.mp4" }))).toBe("bad_host_ref");
    expect(await refusal(w.dhi.as.mutation(api.films.upload, { ...selfHelp, cover: "javascript:alert(1)" }))).toBe("bad_cover");
    await approved(w, academic);
    const text = JSON.stringify(await w.s.as.query(api.films.list, {}));
    expect(text).not.toContain("hostRef");
    expect(text).not.toContain("rightOption");
    expect(text).not.toContain("night.mp4");
  });

  test("covers AC-7: the play link is the stand in path for a local file, and a hosted id says the host is not ready", async () => {
    const w = await world();
    const filmId = await approved(w);
    expect(await w.s.as.mutation(api.films.playLink, { filmId })).toMatchObject({ ok: true, url: "/landing/night.mp4", furthestSec: 0, kept: false });
    const hosted = await approved(w, { ...selfHelp, title: "Hosted", hostRef: "0123456789abcdef0123456789abcdef" });
    expect(await w.s.as.mutation(api.films.playLink, { filmId: hosted })).toEqual({ ok: false, code: "host_not_ready" });
  });

  test("covers AC-1: a film that is not approved has no play link", async () => {
    const w = await world();
    const filmId = await w.dhi.as.mutation(api.films.upload, selfHelp);
    expect(await w.s.as.mutation(api.films.playLink, { filmId })).toEqual({ ok: false, code: "not_found" });
  });

  test("covers AC-5: a jump forward is refused by the server's own record, and a finish straight away is not_finished", async () => {
    const w = await world();
    const filmId = await approved(w);
    expect(await w.s.as.mutation(api.films.progress, { filmId, seconds: 18 })).toMatchObject({ ok: true, furthestSec: 5 });
    expect(await w.s.as.mutation(api.films.finish, { filmId, seconds: 20 })).toEqual({ ok: false, code: "not_finished" });
    expect((await w.s.as.query(api.films.list, {})).keptCount).toBe(0);
  });

  test("covers AC-3: progress is saved by the server and comes back on the next link", async () => {
    const w = await world();
    const filmId = await approved(w);
    await w.s.as.mutation(api.films.progress, { filmId, seconds: 5 });
    vi.setSystemTime(NOW + 5000);
    await w.s.as.mutation(api.films.progress, { filmId, seconds: 10 });
    expect(await w.s.as.mutation(api.films.playLink, { filmId })).toMatchObject({ ok: true, furthestSec: 10 });
    expect((await w.s.as.query(api.films.list, {})).films[0].ratio).toBe(0.5);
  });

  test("covers AC-4: watching to the end writes the score once, and one event holding only the category", async () => {
    const w = await world();
    const filmId = await approved(w);
    let sec = 0;
    for (let i = 0; i < 4; i += 1) {
      sec = Math.min(20, sec + 5);
      vi.setSystemTime(NOW + i * 5000);
      await w.s.as.mutation(api.films.progress, { filmId, seconds: sec });
    }
    vi.setSystemTime(NOW + 20 * 1000);
    expect(await w.s.as.mutation(api.films.finish, { filmId, seconds: 20 })).toEqual({ ok: true, score: 10, first: true });
    const events = (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.room === "modules");
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ category: "self_help" });
    expect(await w.s.as.mutation(api.films.finish, { filmId, seconds: 20 })).toEqual({ ok: true, score: 10, first: false });
    expect((await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.room === "modules")).toHaveLength(1);
    const list = await w.s.as.query(api.films.list, {});
    expect(list).toMatchObject({ keptCount: 1, score: 10 });
    expect(list.films[0]).toMatchObject({ kept: true, ratio: 1 });
  });

  test("covers AC-5: a script that reports every second gains no more than about 1.25 times real time", async () => {
    const w = await world();
    const filmId = await approved(w, { ...selfHelp, durationSec: 600 });
    let furthest = 0;
    for (let i = 0; i < 60; i += 1) {
      vi.setSystemTime(NOW + i * 1000);
      const r = await w.s.as.mutation(api.films.progress, { filmId, seconds: 600 });
      if (r.ok) furthest = r.furthestSec;
    }
    expect(furthest).toBeLessThanOrEqual(5 + 60 * 1.25);
    expect(furthest).toBeLessThan(600);
  });

  test("covers AC-2: a teacher has no film list", async () => {
    const w = await world();
    await approved(w);
    expect(await refusal(w.teacher.as.query(api.films.list, {}))).toBe("forbidden");
  });

  test("covers AC-3: the export holds the student's film progress, and erase removes it", async () => {
    const w = await world();
    const filmId = await approved(w);
    await w.s.as.mutation(api.films.progress, { filmId, seconds: 5 });
    const page = await w.t.run((ctx) => filmRoom.exporter(ctx, w.s.memberId, null, 10));
    expect(page.rows).toHaveLength(1);
    expect(Object.keys(page.rows[0] as object).sort()).toEqual(["film", "kept", "score"]);
    await w.t.run((ctx) => filmRoom.eraser(ctx, w.s.memberId, 10));
    expect((await w.s.as.query(api.films.list, {})).films[0].ratio).toBe(0);
  });
});

describe("the module rules", () => {
  test("the progress cap: the first report reaches 5 seconds, later ones add real time plus a second, and a quick report changes nothing", () => {
    const base = { furthest: 0, lastAt: undefined, now: 100_000, reported: 50, durationSec: 100 };
    expect(progressAfter(base)).toEqual({ furthest: 5, accepted: true });
    expect(progressAfter({ ...base, furthest: 5, lastAt: 100_000, now: 105_000, reported: 50 })).toEqual({ furthest: 11, accepted: true });
    expect(progressAfter({ ...base, furthest: 5, lastAt: 100_000, now: 102_000, reported: 8 })).toEqual({ furthest: 5, accepted: false });
    expect(progressAfter({ ...base, furthest: 5, lastAt: 100_000, now: 102_000, reported: 8, ignoreInterval: true })).toEqual({ furthest: 8, accepted: true });
  });

  test("the progress cap never goes down, never passes the film, and ignores a bad report", () => {
    expect(progressAfter({ furthest: 40, lastAt: 0, now: 10_000, reported: 3, durationSec: 100 }).furthest).toBe(40);
    expect(progressAfter({ furthest: 98, lastAt: 0, now: 100_000, reported: 500, durationSec: 100 }).furthest).toBe(100);
    expect(progressAfter({ furthest: 0, lastAt: undefined, now: 0, reported: Number.NaN, durationSec: 100 })).toEqual({ furthest: 0, accepted: false });
    expect(progressAfter({ furthest: 0, lastAt: undefined, now: 0, reported: -5, durationSec: 100 })).toEqual({ furthest: 0, accepted: false });
  });

  test("the end of a film is within the tolerance of its length", () => {
    expect(reachedEnd(100 - FINISH_TOLERANCE_SEC, 100)).toBe(true);
    expect(reachedEnd(100 - FINISH_TOLERANCE_SEC - 1, 100)).toBe(false);
  });

  test("the host reference and the upload checks", () => {
    expect(hostRefProblem("/landing/day.mp4")).toBeNull();
    expect(hostRefProblem("0123456789abcdef0123456789abcdef")).toBeNull();
    expect(hostRefProblem("/landing/../x.mp4")).toBe("bad_host_ref");
    expect(hostRefProblem("http://a/b.mp4")).toBe("bad_host_ref");
    expect(uploadProblem({ ...selfHelp })).toBeNull();
    expect(uploadProblem({ ...selfHelp, durationSec: 5 })).toBe("bad_duration");
    expect(uploadProblem({ ...selfHelp, scoreValue: 0 })).toBe("bad_score");
    expect(uploadProblem({ ...selfHelp, category: "other" })).toBe("bad_category");
    expect(uploadProblem({ ...academic })).toBeNull();
    expect(uploadProblem({ ...academic, checks: [{ ...check, rightOption: 9 }, check] })).toBe("bad_check");
  });
});
