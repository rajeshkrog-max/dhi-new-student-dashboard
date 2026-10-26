/// <reference types="vite/client" />
// Parent sharing and the weekly parent page (spec house/0022). A parent has no account: they hold the student's private link. Each test names the
// criterion it covers. The days behind the page are the hand made weeks of brainFixtures.ts, stored the way the rollup stores them.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { scenarioRows, type Scenario } from "./brainFixtures";
import { todayOf } from "./dayRules";
import { METRIC_VERSION } from "./metricRules";
import { LINK_DAYS } from "./parentLinkCore";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ERASURE_HASH_SECRET;
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const other = await makeStudent(t, A.admin, a1, "other@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, other]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-08-01T10:00:00+05:30") });
    await ctx.db.patch(s.memberId, { name: "Suzzy Glass" });
  });
  return { t, dhi, A, a1, teacher, s, other };
}
type World = Awaited<ReturnType<typeof world>>;

async function store(w: World, p: Person, scenario: Scenario) {
  await w.t.run(async (ctx) => {
    const member = await ctx.db.get(p.memberId);
    for (const old of await ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", p.memberId)).collect()) await ctx.db.delete(old._id);
    for (const row of scenarioRows(scenario, todayOf(Date.now()))) {
      await ctx.db.insert("brainDays", { memberId: p.memberId, instituteId: member!.instituteId!, day: row.day, values: row.v as Record<string, { num: number; den: number }>, version: METRIC_VERSION, computedAt: Date.now() });
    }
  });
}

const shareOn = (p: Person) => p.as.mutation(api.sharing.set, { parentLevel: "summary" });
async function makeLink(w: World, p: Person): Promise<string> {
  await shareOn(p);
  const r = await p.as.mutation(api.parentLink.make, {});
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  return r.code;
}
// A parent: no sign in at all.
const open = (w: World, code: string) => w.t.mutation(api.parentReport.open, { code });
const linksOf = (w: World) => w.t.run(async (ctx) => await ctx.db.query("parentLinks").take(500));
const viewsOf = (w: World) => w.t.run(async (ctx) => await ctx.db.query("viewLog").take(500));
const logOf = (w: World) => w.t.run(async (ctx) => await ctx.db.query("accessLog").take(500));
const FAKE = "0".repeat(48);

describe("sharing is off until the student turns it on (AC-1)", () => {
  test("covers AC-1: with sharing off the student cannot make a link and no code opens anything", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    expect(await w.s.as.mutation(api.parentLink.make, {})).toEqual({ ok: false, code: "sharing_off" });
    expect(await w.s.as.query(api.parentLink.mine, {})).toBeNull();
    expect(await open(w, FAKE)).toEqual({ ok: false, code: "gone" });
    expect(await linksOf(w)).toEqual([]);
    expect(await viewsOf(w)).toEqual([]);
  });

  test("covers AC-1: only a student makes, sees or removes a link", async () => {
    const w = await world();
    expect(await refusal(w.teacher.as.mutation(api.parentLink.make, {}))).toBe("forbidden");
    expect(await refusal(w.A.admin.as.mutation(api.parentLink.remove, {}))).toBe("forbidden");
    expect(await refusal(w.dhi.as.query(api.parentLink.mine, {}))).toBe("forbidden");
    // Not signed in: refused by the entry check, not served.
    expect(await refusal(w.t.mutation(api.parentLink.make, {}))).not.toBe("ok");
  });
});

describe("what the parent sees (AC-2, AC-3)", () => {
  test("covers AC-2: days logged in the last 7 finished days and the three lamp values, and nothing else", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    const code = await makeLink(w, w.s);
    const r = await open(w, code);
    if (!r.ok) throw new Error("open");
    expect(r.firstName).toBe("Suzzy");
    expect(r.week.enough).toBe(true);
    expect(r.week.from).toBe("2026-10-13");
    expect(r.week.to).toBe("2026-10-19");
    expect(r.week.rooms.map((x) => x.room).sort()).toEqual(["blog", "day", "habits", "hour", "modules", "mood", "papers", "sleep"]);
    for (const room of r.week.rooms) expect(Number.isInteger(room.days) && room.days >= 0 && room.days <= 7).toBe(true);
    expect(r.week.lamps.map((l) => l.lamp)).toEqual(["sadhana", "niyam", "viveka"]);
    // Whole numbers from 0 to 100, the same as the student's own lamps.
    const own = await w.s.as.query(api.brain.report, {});
    for (const lamp of r.week.lamps) {
      const mine = own.lamps.find((l) => l.lamp === lamp.lamp)!;
      expect(lamp.value).toBe(mine.value === null ? null : Math.round(mine.value * 100));
    }
    expect(Object.keys(r).sort()).toEqual(["expiresAt", "firstName", "ok", "week"]);
    expect(Object.keys(r.week).sort()).toEqual(["enough", "from", "lamps", "rooms", "to"]);
  });

  test("covers AC-3: a heavy fortnight shows no mood value, note, pattern, support offer or movement to a parent", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    const own = await w.s.as.query(api.brain.report, {});
    // The student's own report holds a pattern, an expression note and a support offer for this fortnight ...
    expect(own.patterns.length).toBeGreaterThan(0);
    expect(own.support).not.toBeNull();
    expect(own.expression).not.toBeNull();
    // ... and the parent's page holds none of it.
    const r = await open(w, await makeLink(w, w.s));
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/pattern|support|expression|evidence|movement|dipping|rising|steady|low_mood|lowDays|score|hidden|note|E0\d|H0\d/i);
    if (!r.ok) throw new Error("open");
    expect(r.week.lamps.every((l) => l.value === null || (Number.isInteger(l.value) && l.value >= 0 && l.value <= 100))).toBe(true);
  });

  test("covers AC-3: until the student has logged 5 of the last 14 days the lamps are empty, as in their own Brain", async () => {
    const w = await world();
    const r = await open(w, await makeLink(w, w.s));
    if (!r.ok) throw new Error("open");
    expect(r.week.enough).toBe(false);
    expect(r.week.lamps.map((l) => l.value)).toEqual([null, null, null]);
    expect(r.week.rooms.every((x) => x.days === 0)).toBe(true);
  });

  test("covers AC-3: a link shows its own student only", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    await store(w, w.other, "heavy");
    const mine = await open(w, await makeLink(w, w.s));
    const theirs = await open(w, await makeLink(w, w.other));
    if (!mine.ok || !theirs.ok) throw new Error("open");
    expect(mine.week).not.toEqual(theirs.week);
    expect(mine.firstName).toBe("Suzzy");
    expect(theirs.firstName).not.toBe("Suzzy");
  });
});

describe("the link (AC-4, AC-5)", () => {
  test("covers AC-4: the code is returned once and only its hash is stored", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    expect(code).toMatch(/^[a-f0-9]{48}$/);
    const rows = await linksOf(w);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(code);
    expect(rows[0].codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].expiresAt).toBe(NOW + LINK_DAYS * DAY);
    expect(await w.s.as.query(api.parentLink.mine, {})).toEqual({ expiresAt: NOW + LINK_DAYS * DAY });
  });

  test("covers AC-4: making a new link replaces the old one, so the old address stops working", async () => {
    const w = await world();
    const first = await makeLink(w, w.s);
    const second = await makeLink(w, w.s);
    expect(second).not.toBe(first);
    expect(await linksOf(w)).toHaveLength(1);
    expect(await open(w, first)).toEqual({ ok: false, code: "gone" });
    expect((await open(w, second)).ok).toBe(true);
  });

  test("covers AC-4: removing the link ends it at once, and removing it again does nothing", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    expect(await w.s.as.mutation(api.parentLink.remove, {})).toEqual({ removed: true });
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
    expect(await w.s.as.mutation(api.parentLink.remove, {})).toEqual({ removed: false });
    // Sharing is still on, so the student can make another.
    expect((await open(w, await makeLink(w, w.s))).ok).toBe(true);
  });

  test("covers AC-5: turning sharing off deletes the link and nothing shows, and turning it back on does not revive it", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    const code = await makeLink(w, w.s);
    expect((await open(w, code)).ok).toBe(true);
    await w.s.as.mutation(api.sharing.set, { parentLevel: "none" });
    expect(await linksOf(w)).toEqual([]);
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
    await shareOn(w.s);
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
  });

  test("covers AC-5: a link whose sharing setting is off shows nothing even if a row was left behind", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    await w.t.run(async (ctx) => {
      const setting = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first();
      await ctx.db.patch(setting!._id, { parentLevel: "none" });
    });
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
  });

  test("covers AC-5: a link ends after 90 days, and the daily sweep deletes the row", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    vi.setSystemTime(NOW + LINK_DAYS * DAY - 1000);
    expect((await open(w, code)).ok).toBe(true);
    vi.setSystemTime(NOW + LINK_DAYS * DAY + 1000);
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
    await w.t.mutation(internal.retention.sweep, {});
    expect(await linksOf(w)).toEqual([]);
  });

  test("covers AC-5: a student who withdraws, or is removed, is invisible to the parent", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    expect((await open(w, code)).ok).toBe(true);
    await w.s.as.mutation(api.consent.withdraw, {});
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
    await w.s.as.mutation(api.consent.restore, {});
    expect((await open(w, code)).ok).toBe(true);
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.s.memberId });
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
  });

  test("covers AC-5: a wrong, short or made up code is the same plain answer, and a flood of them is limited", async () => {
    const w = await world();
    await makeLink(w, w.s);
    for (const code of ["", "abc", FAKE, "G".repeat(48), "a".repeat(49)]) expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
    const answers = new Set<string>();
    for (let i = 0; i < 140; i++) {
      const r = await open(w, FAKE);
      answers.add(r.ok ? "ok" : r.code);
    }
    expect([...answers].sort()).toEqual(["gone", "slow_down"]);
    // No key per made up code: the limit is one shared bucket and nothing was stored for the codes.
    expect(await linksOf(w)).toHaveLength(1);
  });

  test("covers AC-5: making a link is limited for each student", async () => {
    const w = await world();
    await shareOn(w.s);
    const answers: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await w.s.as.mutation(api.parentLink.make, {});
      answers.push(r.ok ? "ok" : r.code);
    }
    expect(answers.filter((a) => a === "ok")).toHaveLength(10);
    expect(answers.slice(10)).toEqual(["slow_down", "slow_down"]);
  });
});

describe("the record and the student's own data rights (AC-6, AC-7)", () => {
  test("covers AC-6: making, removing and switching off each leave one access log row of a fixed code, with ids only", async () => {
    const w = await world();
    await makeLink(w, w.s);
    await w.s.as.mutation(api.parentLink.remove, {});
    await makeLink(w, w.s);
    await w.s.as.mutation(api.sharing.set, { parentLevel: "none" });
    const actions = (await logOf(w)).map((l) => l.action).filter((a) => a.startsWith("sharing."));
    // Turning it on again after nothing changed writes no second sharing.set; switching off writes the set, then the end of the link.
    expect(actions).toEqual(["sharing.set", "sharing.link", "sharing.unlink", "sharing.link", "sharing.set", "sharing.unlink"]);
    for (const row of await logOf(w)) expect(Object.keys(row).every((k) => ["_id", "_creationTime", "at", "actor", "action", "instituteId", "targetMemberId", "inviteId"].includes(k))).toBe(true);
  });

  test("covers AC-6: a look through the link is in the student's own record as Parent, once an hour for one link, and a refused look leaves nothing", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    const code = await makeLink(w, w.s);
    await open(w, FAKE);
    expect(await viewsOf(w)).toEqual([]);
    for (let i = 0; i < 4; i++) await open(w, code);
    let logs = await viewsOf(w);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ viewerRole: "parent", targetMemberId: w.s.memberId, kind: "brain", at: NOW });
    expect(logs[0].viewerId).toBeUndefined();
    vi.setSystemTime(NOW + HOUR + 1000);
    await open(w, code);
    logs = await viewsOf(w);
    expect(logs).toHaveLength(2);
    const shown = await w.s.as.query(api.access.mine, { paginationOpts: { numItems: 25, cursor: null } });
    expect(shown.page.map((r) => r.role)).toEqual(["Parent", "Parent"]);
    // Nobody else sees the student's record, and a student sees none of another's.
    const theirs = await w.other.as.query(api.access.mine, { paginationOpts: { numItems: 25, cursor: null } });
    expect(theirs.page).toEqual([]);
  });

  test("covers AC-7: the download carries the setting and the link's dates, never the code", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    const r = (await w.s.as.mutation(api.dataRights.exportMine, {})) as { ok: true; rows: { sharing: unknown }[] };
    expect(r.rows[0].sharing).toEqual({ parentLevel: "summary", link: { createdAt: NOW, expiresAt: NOW + LINK_DAYS * DAY } });
    expect(JSON.stringify(r)).not.toContain(code);
  });

  test("covers AC-7: erasing a student deletes the link and the page stops at once", async () => {
    const w = await world();
    const code = await makeLink(w, w.s);
    expect(await w.s.as.mutation(api.dataRights.eraseMine, { confirm: true })).toEqual({ ok: true });
    expect(await linksOf(w)).toEqual([]);
    expect(await open(w, code)).toEqual({ ok: false, code: "gone" });
  });
});

describe("the wall (AC-8)", () => {
  const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const code = (name: string) => files[name].split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  test("covers AC-8: the parent files read the Brain only through its shared reader and the pure rules, and nothing else of the student's rooms", () => {
    for (const name of ["./parentReport.ts", "./parentRules.ts", "./parentLink.ts", "./parentLinkCore.ts"]) {
      expect(code(name), name).not.toMatch(/query\(\s*["'](brainDays|moodDays|sleepNights|habitChecks|habitPlans|mealLogs|events|exams|blogPosts)["']/);
      expect(code(name), name).not.toMatch(/staffRead\(|classTotal\(/);
    }
    expect(code("./parentRules.ts")).not.toMatch(/patternsOf|supportOffer|expressionNote|\.movement|\.inputs/);
    expect(code("./parentReport.ts")).toMatch(/canView\(\s*"parent"/);
  });

  test("covers AC-8: no teacher, institute admin, DHI admin or counselor function returns the link or the page", () => {
    for (const [name, text] of Object.entries(files)) {
      if (name.endsWith(".test.ts") || name.startsWith("./_generated/")) continue;
      if (["./parentReport.ts", "./parentLink.ts", "./parentLinkCore.ts", "./eraseCore.ts", "./dataRights.ts", "./retention.ts", "./sharing.ts", "./schema.ts", "./dataMap.ts"].includes(name)) continue;
      expect(text, name).not.toMatch(/["']parentLinks["']/);
    }
  });
});
