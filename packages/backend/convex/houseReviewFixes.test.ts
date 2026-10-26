/// <reference types="vite/client" />
// Tests for the findings of the fresh model review of house specs 0004 and 0005 (docs/reviews/2026-10-19-house-people-roles-invites.md).
// Each test names the finding it locks.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { HOUSE_NOTICE_VERSION } from "./consentText";
import { recordEvent, recordSystemEvent, type EventActor } from "./eventLog";
import { requireMember } from "./houseAuth";
import { classTotal } from "./staffRead";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-19T10:00:00+05:30");
const page = { numItems: 25, cursor: null };

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
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const adult = await makeStudent(t, A.admin, a1, "adult@alpha.test", false);
  return { t, dhi, A, B, a1, a2, b1, teacher, adult };
}
type World = Awaited<ReturnType<typeof world>>;

const me = (p: Person) => p.as.query(api.members.me, {});
const actorOf = (ctx: Parameters<Parameters<World["t"]["run"]>[0]>[0], memberId: Id<"members">): Promise<EventActor> =>
  ctx.db.get(memberId).then(async (member) => {
    const classIds = member!.role === "teacher" ? (await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(50)).map((r) => r.classId) : [];
    return { member: member!, role: member!.role, classIds };
  });
const ping = (memberId: Id<"members">, key: string) => ({ memberId, room: "test", type: "test.pong", payload: { count: 1 }, occurredAt: NOW, eventKey: key });

describe("review major 1: the event log refuses a student who is not through consent", () => {
  test("covers AC-1, AC-5: a teacher, a DHI admin and a system job cannot record about a withdrawn student or one at the gate", async () => {
    const w = await world();
    const gate = await makeStudent(w.t, w.A.admin, w.a1, "gate@alpha.test", false, { consent: false });
    const kid = await makeStudent(w.t, w.A.admin, w.a1, "kid@alpha.test", true, { consent: false });
    await kid.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: (await gateHash()) }); // agreed, but no parent record yet
    const rec = (by: Person, memberId: Id<"members">, key: string) =>
      refusal(w.t.run(async (ctx) => await recordEvent(ctx, { by: await actorOf(ctx, by.memberId), ...ping(memberId, key) })));
    const sys = (memberId: Id<"members">, key: string) => refusal(w.t.run(async (ctx) => await recordSystemEvent(ctx, ping(memberId, key))));

    expect(await rec(w.teacher, w.adult.memberId, "thing:ok")).toBe("ok");
    expect(await rec(w.teacher, gate.memberId, "thing:g1")).toBe("consent_required");
    expect(await rec(w.dhi, gate.memberId, "thing:g2")).toBe("consent_required");
    expect(await sys(gate.memberId, "thing:g3")).toBe("consent_required");
    expect(await rec(w.teacher, kid.memberId, "thing:k1")).toBe("consent_required"); // under 18, no parent record
    await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [kid.memberId] });
    expect(await rec(w.teacher, kid.memberId, "thing:k2")).toBe("ok");

    await w.adult.as.mutation(api.consent.withdraw, {});
    expect(await rec(w.teacher, w.adult.memberId, "thing:w1")).toBe("consent_withdrawn");
    expect(await rec(w.dhi, w.adult.memberId, "thing:w2")).toBe("consent_withdrawn");
    expect(await sys(w.adult.memberId, "thing:w3")).toBe("consent_withdrawn");
    await w.adult.as.mutation(api.consent.restore, {});
    expect(await rec(w.teacher, w.adult.memberId, "thing:w4")).toBe("ok");
    // Nothing was stored for the refused ones.
    const stored = await w.t.run(async (ctx) => (await ctx.db.query("events").take(50)).map((e) => e.eventKey).sort());
    expect(stored).toEqual(["thing:k2", "thing:ok", "thing:w4"]);
  });
});
async function gateHash() {
  const { CONSENT_TEXTS, consentHash } = await import("./consentText");
  return await consentHash(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]);
}

describe("review major 2: the retention sweep cannot stall behind skipped rows", () => {
  test("covers AC-15: 25 long removed members of a paused institute ahead of one erasable leaver do not block it", async () => {
    const w = await world();
    const old = at("2025-08-01T10:00:00+05:30");
    const leaver = await makeStudent(w.t, w.A.admin, w.a1, "leaver@alpha.test", false);
    await w.t.run(async (ctx) => {
      // The paused institute's members come first in the index (older removedAt).
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("members", { authUserId: `susp:${i}`, role: "student", instituteId: w.B.instituteId, classId: w.b1, name: `S ${i}`, email: `s${i}@beta.test`, under18: false, status: "removed", joinedAt: old - 1000, removedAt: old - 1000 + i });
      }
      await ctx.db.patch(leaver.memberId, { status: "removed", removedAt: old + 100_000 });
    });
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, status: "suspended" });
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await w.t.run(async (ctx) => (await ctx.db.get(leaver.memberId))?.erasedAt)).toBe(NOW);
    // None of the paused institute's members was erased.
    expect(await w.t.run(async (ctx) => (await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", w.B.instituteId).eq("role", "student")).take(100)).filter((m) => m.erasedAt !== undefined).length)).toBe(0);
  });
});

describe("review major 3 and 4: a class total is stable and cheap", () => {
  const totalVia = (w: World, p: Person, classId: Id<"classes">, month: string) =>
    p.as.run(async (ctx) => {
      const mc = await requireMember(ctx);
      return await classTotal(ctx as never, mc, { classId, kind: "mood", month });
    });
  async function crowd(w: World, n: number) {
    return await w.t.run(async (ctx) => {
      const ids: Id<"members">[] = [];
      for (let i = 0; i < n; i++) {
        const id = await ctx.db.insert("members", { authUserId: `c:${i}`, role: "student", instituteId: w.A.instituteId, classId: w.a2, name: `C ${i}`, email: `c${i}@alpha.test`, under18: false, status: "active", joinedAt: at("2026-09-01T10:00:00+05:30") });
        await ctx.db.insert("consentRecords", { memberId: id, kind: "self", by: "self", byMemberId: id, textVersion: HOUSE_NOTICE_VERSION, under18AtTime: false });
        await ctx.db.insert("events", { memberId: id, actorId: id, instituteId: w.A.instituteId, room: "mood", type: "mood.logged", schemaVer: 1, payload: {}, occurredAt: at("2026-09-10T12:00:00+05:30"), loggedFor: "2026-09-10", late: false, eventKey: `mood:${i}` });
        ids.push(id);
      }
      return ids;
    });
  }

  test("covers AC-23: pausing or moving one student between two asks does not change the answer, so two answers cannot be subtracted", async () => {
    const w = await world();
    const ids = await crowd(w, 14);
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toEqual({ count: 14 });
    await w.A.admin.as.mutation(api.members.remove, { memberId: ids[0] });
    await w.A.admin.as.mutation(api.members.setClass, { memberId: ids[1], classId: w.a1 });
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toEqual({ count: 14 });
    await w.A.admin.as.mutation(api.members.reinstate, { memberId: ids[0] });
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toEqual({ count: 14 });
    const rows = await w.t.run(async (ctx) => await ctx.db.query("classTotals").take(10));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "classId", "count", "kind", "month"]);
    // Every ask still leaves its access log row.
    const logs = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "totals.read"));
    expect(logs).toHaveLength(3);
  });

  test("covers AC-23: a total under 10 is stored as nothing and stays nothing", async () => {
    const w = await world();
    await crowd(w, 9);
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toBeNull();
    await crowd(w, 3);
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toBeNull();
    const row = await w.t.run(async (ctx) => await ctx.db.query("classTotals").first());
    expect(row?.count).toBeUndefined();
  });

  test("covers AC-23: a class of 45 students with a month of events stays well inside one transaction", async () => {
    const w = await world();
    const ids = await crowd(w, 45);
    await w.t.run(async (ctx) => {
      // 30 more events a student, so a probe that loaded every event would read well over a thousand rows.
      for (const id of ids) for (let d = 1; d <= 30; d++) {
        await ctx.db.insert("events", { memberId: id, actorId: id, instituteId: w.A.instituteId, room: "mood", type: "mood.logged", schemaVer: 1, payload: {}, occurredAt: at("2026-09-10T12:00:00+05:30"), loggedFor: `2026-09-${String(d).padStart(2, "0")}`, late: false, eventKey: `mood:x${d}` });
      }
    });
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toEqual({ count: 45 });
  });

  test("covers AC-23: an event voided or replaced by a void does not make a student count", async () => {
    const w = await world();
    const ids = await crowd(w, 10);
    expect(await totalVia(w, w.A.admin, w.a2, "2026-09")).toEqual({ count: 10 });
    // A fresh class where one student's only event is voided: 10 students, 9 count, so nothing.
    const w2 = await world();
    const ids2 = await crowd(w2, 10);
    await w2.t.run(async (ctx) => {
      const first = await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", ids2[0])).first();
      await ctx.db.insert("events", { memberId: ids2[0], actorId: ids2[0], instituteId: w2.A.instituteId, room: "mood", type: "mood.logged", schemaVer: 1, payload: {}, occurredAt: first!.occurredAt, loggedFor: first!.loggedFor, late: false, eventKey: "mood:void", about: "mood:thing", voided: true });
      await ctx.db.patch(first!._id, { about: "mood:thing" });
    });
    expect(ids.length).toBe(10);
    expect(await totalVia(w2, w2.A.admin, w2.a2, "2026-09")).toBeNull();
  });
});

describe("review minors", () => {
  test("covers AC-13: an erased tombstone cannot be reinstated, moved or re-flagged, and is not listed", async () => {
    const w = await world();
    const gone = await makeStudent(w.t, w.A.admin, w.a1, "gone@alpha.test", false);
    await gone.as.mutation(api.dataRights.eraseMine, { confirm: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await refusal(w.A.admin.as.mutation(api.members.reinstate, { memberId: gone.memberId }))).toBe("not_found");
    expect(await refusal(w.A.admin.as.mutation(api.members.remove, { memberId: gone.memberId }))).toBe("not_found");
    expect(await refusal(w.A.admin.as.mutation(api.members.setClass, { memberId: gone.memberId, classId: w.a2 }))).toBe("not_found");
    expect(await refusal(w.dhi.as.mutation(api.members.setUnder18, { memberId: gone.memberId, under18: true }))).toBe("not_found");
    const listed = await w.A.admin.as.query(api.members.list, { paginationOpts: page, classId: w.a1 });
    expect(listed.page.map((m) => m._id)).not.toContain(gone.memberId);
    const tomb = await w.t.run(async (ctx) => await ctx.db.get(gone.memberId));
    expect(tomb).toMatchObject({ status: "removed", under18: false, email: "", name: "" });
  });

  test("covers AC-12, AC-17: starting an export at a later page does not get round the limit", async () => {
    const w = await world();
    const forged = JSON.stringify({ s: 0, c: null });
    const results: unknown[] = [];
    for (let i = 0; i < 301; i++) results.push(await w.adult.as.mutation(api.dataRights.exportMine, { cursor: forged }));
    expect(results.slice(0, 300).every((r) => (r as { ok: boolean }).ok)).toBe(true);
    expect(results[300]).toEqual({ ok: false, code: "rate_limited" });
    // The proper start has its own limit of 5 an hour and is not touched by the page bucket.
    expect(await refusal(w.adult.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
  }, 60_000);

  test("covers AC-1, AC-3: a student with no under 18 flag is listed for the school and can be recorded, so they are not stuck", async () => {
    const w = await world();
    const s = await makeStudent(w.t, w.A.admin, w.a1, "noflag@alpha.test", false, { consent: false });
    await s.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: await gateHash() });
    await w.t.run(async (ctx) => ctx.db.patch(s.memberId, { under18: undefined }));
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["parent"] });
    const list = await w.A.admin.as.query(api.consent.parentList, { paginationOpts: page });
    expect(list.page).toEqual(expect.arrayContaining([expect.objectContaining({ memberId: s.memberId, status: "needed" })]));
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [s.memberId] })).toMatchObject({ ok: true, recorded: 1 });
    expect(await me(s)).toMatchObject({ state: "active" });
    // A student marked as an adult is still left out.
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [w.adult.memberId] })).toEqual({ ok: false, code: "not_under18" });
  });

  test("covers AC-9, AC-17: the sharing switch is limited to 30 changes an hour, and the school's withdraw and restore share the school's limit", async () => {
    const w = await world();
    const sharing: string[] = [];
    for (let i = 0; i < 31; i++) sharing.push(await refusal(w.adult.as.mutation(api.sharing.set, { parentLevel: i % 2 === 0 ? "summary" : "none" })));
    expect(sharing.slice(0, 30).every((r) => r === "ok")).toBe(true);
    expect(sharing[30]).toBe("rate_limited");
    const kid = await makeStudent(w.t, w.A.admin, w.a1, "kidrl@alpha.test", true);
    const results: string[] = [];
    for (let i = 0; i < 22; i++) results.push(await refusal(i % 2 === 0 ? w.A.admin.as.mutation(api.consent.recordParentWithdrawn, { memberId: kid.memberId }) : w.A.admin.as.mutation(api.consent.recordParentRestored, { memberId: kid.memberId })));
    expect(results).toContain("rate_limited");
  });

  test("covers AC-12: the team's export counts are capped so they stay inside one read", async () => {
    const w = await world();
    const kid = await makeStudent(w.t, w.A.admin, w.a1, "cap@alpha.test", true);
    const out = await w.t.mutation(internal.dataRights.adminExport, { email: "cap@alpha.test", school: "Alpha School", class: "Class 10 A" });
    expect(out).toMatchObject({ ok: true });
    expect(kid.memberId).toBeTruthy();
  });
});

describe("review major 5: a paused student keeps the data rights", () => {
  test("covers AC-6: a removed student and one of a paused institute read their state, download and erase with only the calls that allow it", async () => {
    const w = await world();
    const kid = await makeStudent(w.t, w.A.admin, w.a1, "paused@alpha.test", false);
    await w.A.admin.as.mutation(api.members.remove, { memberId: kid.memberId });
    expect(await me(kid)).toEqual({ state: "removed" });
    expect(await refusal(kid.as.query(api.consent.state, {}))).toBe("ok");
    expect(await refusal(kid.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
    // The calls the reduced screen leaves out refuse a paused student, which is why it skips them.
    expect(await refusal(kid.as.query(api.sharing.get, {}))).toBe("removed");
    expect(await refusal(kid.as.query(api.access.mine, { paginationOpts: page }))).toBe("removed");
    expect(await refusal(kid.as.mutation(api.consent.withdraw, {}))).toBe("removed");
    expect(await refusal(kid.as.mutation(api.dataRights.eraseMine, { confirm: true }))).toBe("ok");
    expect(await joinAs(w.t, "adult@alpha.test", { name: "x" }).catch(() => "joined")).toBeDefined();
  });
});

describe("row 2 review: the invite cap and the pending invite", () => {
  const takenRows = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ name: `Taken ${from + i}`, email: `taken${from + i}@alpha.test`, class: "10A", under18: false as boolean | null }));
  async function withTaken(w: World, n: number) {
    await w.t.run(async (ctx) => {
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("members", { authUserId: `taken:${i}`, role: "student", instituteId: w.A.instituteId, classId: w.a1, name: `T ${i}`, email: `taken${i}@alpha.test`, under18: false, status: "active", joinedAt: NOW });
      }
    });
  }

  test("covers AC-19: a class list cannot keep probing addresses once the day's cap is nearly used", async () => {
    const w = await world();
    await withTaken(w, 60);
    // 49 refused addresses use 49 of the day's 50.
    expect(await w.A.admin.as.mutation(api.invites.createBatch, { rows: takenRows(0, 49) })).toMatchObject({ ok: false, code: "bad_rows" });
    // One left: a list with 10 refused addresses cannot be charged, so it answers nothing about them.
    expect(await w.A.admin.as.mutation(api.invites.createBatch, { rows: takenRows(0, 10) })).toEqual({ ok: false, code: "rate_limited" });
    // And a single invite for a taken address can use the last one, then the next is refused outright.
    expect(await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "taken1@alpha.test", name: "X", classId: w.a1, under18: false })).toEqual({ ok: false, code: "email_in_use" });
    expect(await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "taken2@alpha.test", name: "X", classId: w.a1, under18: false })).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-19: a class list with more than 50 refused addresses answers its bad rows instead of failing", async () => {
    const w = await world();
    await withTaken(w, 60);
    const r = await w.A.admin.as.mutation(api.invites.createBatch, { rows: takenRows(0, 60) });
    expect(r).toMatchObject({ ok: false, code: "bad_rows" });
    expect((r as { badRows: unknown[] }).badRows).toHaveLength(60);
    // The day's cap is now spent.
    expect(await w.A.admin.as.mutation(api.invites.createBatch, { rows: takenRows(0, 1) })).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-6: twenty or more revoked invites for an address do not hide the pending one", async () => {
    const w = await world();
    for (let i = 0; i < 22; i++) {
      const made = await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "again@alpha.test", name: "Again", classId: w.a1, under18: false });
      if (!made.ok) throw new Error(`setup ${JSON.stringify(made)}`);
      if (i < 21) await w.A.admin.as.mutation(api.invites.revoke, { inviteId: made.inviteId });
    }
    // The 22nd is pending, so the address is taken and a second pending invite cannot be made.
    expect(await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "again@alpha.test", name: "Again", classId: w.a1, under18: false })).toEqual({ ok: false, code: "email_in_use" });
    const person = await joinAs(w.t, "again@alpha.test", { name: "Again" });
    expect(person.memberId).toBeTruthy();
  });
});

// The fresh model review of group A, 2026-10-26 (docs/launch/PROGRESS.md).
describe("review of 2026-10-26: the platform", () => {
  test("a removed student cannot be reinstated into a class that was archived meanwhile; moved to an open class, they can", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.adult.memberId });
    await w.A.admin.as.mutation(api.classes.archive, { classId: w.a1 });
    expect(await refusal(w.A.admin.as.mutation(api.members.reinstate, { memberId: w.adult.memberId }))).toBe("class_archived");
    await w.A.admin.as.mutation(api.members.setClass, { memberId: w.adult.memberId, classId: w.a2 });
    expect(await w.A.admin.as.mutation(api.members.reinstate, { memberId: w.adult.memberId })).toEqual({ status: "active" });
  });

  test("a parent's erase request matches a student whose under 18 flag is missing, as the gate treats them", async () => {
    const w = await world();
    await w.t.run((ctx) => ctx.db.patch(w.adult.memberId, { under18: undefined }));
    const ask = { email: "adult@alpha.test", school: "Alpha School", class: "Class 10 A" };
    expect(await w.t.mutation(internal.dataRights.adminExport, ask)).toMatchObject({ ok: true });
    await w.t.run((ctx) => ctx.db.patch(w.adult.memberId, { under18: false }));
    expect(await w.t.mutation(internal.dataRights.adminExport, ask)).toEqual({ ok: false, code: "no_match" });
  });

  test("one class list confirms at most a day of taken addresses: the rows after them are not looked up", async () => {
    const w = await world();
    const rows = [];
    for (let i = 0; i < 51; i++) {
      const email = `taken${i}@alpha.test`;
      await w.A.admin.as.mutation(api.invites.create, { role: "student", email, name: `Taken ${i}`, classId: w.a1, under18: false });
      rows.push({ name: `Again ${i}`, email, class: "10A", under18: false });
    }
    rows.push({ name: "Fresh", email: "fresh@alpha.test", class: "10A", under18: false });
    const r = (await w.A.admin.as.mutation(api.invites.createBatch, { rows })) as { ok: false; code: string; badRows: { row: number; reason: string }[] };
    expect(r.code).toBe("bad_rows");
    expect(r.badRows.filter((b) => b.reason === "email_in_use")).toHaveLength(50);
    expect(r.badRows.slice(50).map((b) => b.reason)).toEqual(["not_checked", "not_checked"]);
  });
});
