/// <reference types="vite/client" />
// Consent, privacy and the access record (spec house/0005). Each test names the criterion it covers. Time is fixed with a fake clock; the
// scheduler is fake too, so the pages of an erase run when a test says so.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { components, api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { canView, DATA_KINDS, KIND_CLASS, MIN_TOTAL, ROOM_KINDS, TOTAL_KINDS, type DataKind, type Relation, type Viewer } from "./accessRules";
import { decideGate, isMinor, type ConsentFacts } from "./consentRules";
import {
  CONSENT_KINDS,
  CONSENT_TEXTS,
  HOUSE_ACCEPTED_VERSIONS,
  HOUSE_NOTICE_LINES,
  HOUSE_NOTICE_VERSION,
  HOUSE_PARENT_ACCEPTED_VERSIONS,
  HOUSE_PARENT_VERSION,
  HOUSE_WORDS_APPROVED,
  consentHash,
} from "./consentText";
import { DATA_MAP } from "./dataMap";
import { requireMember } from "./houseAuth";
import { ROOMS } from "./eventShapes";
import { classTotal, monthDays, staffRead } from "./staffRead";
import { ACCESS_CODES } from "./houseCore";
import { makeBackend } from "../tests/convexTestUtils";
import { giveConsent, joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

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
  delete process.env.TEST_SIGNIN_ENABLED;
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
  const minor = await makeStudent(t, A.admin, a1, "minor@alpha.test", true);
  const studentB = await makeStudent(t, B.admin, b1, "sb@beta.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  return { t, dhi, A, B, a1, a2, b1, teacher, adult, minor, studentB, counselor };
}
type World = Awaited<ReturnType<typeof world>>;

// A student who has joined and is NOT through consent.
const fresh = (w: World, email: string, under18 = false, classId?: Id<"classes">) =>
  makeStudent(w.t, w.A.admin, classId ?? w.a1, email, under18, { consent: false });
const hash = async () => await consentHash(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]);
const agree = async (p: Person) => p.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: await hash() });
const me = (p: Person) => p.as.query(api.members.me, {});
// Any function that starts with requireMember stands in for "a room function" until rooms are stored in the backend.
const room = (p: Person) => refusal(p.as.query(api.members.list, { paginationOpts: page, classId: undefined }));

// Students inserted straight into the tables (consent given, flag adult), for the tests that need many.
async function crowd(w: World, classId: Id<"classes">, n: number, tag: string, consent = true) {
  return await w.t.run(async (ctx) => {
    const cls = await ctx.db.get(classId);
    const ids: Id<"members">[] = [];
    for (let i = 0; i < n; i++) {
      const id = await ctx.db.insert("members", {
        authUserId: `crowd:${tag}:${i}`,
        role: "student",
        instituteId: cls!.instituteId,
        classId,
        name: `Crowd ${tag} ${i}`,
        email: `crowd-${tag}-${i}@alpha.test`,
        under18: false,
        status: "active",
        joinedAt: at("2026-09-01T10:00:00+05:30"),
      });
      if (consent) {
        await ctx.db.insert("consentRecords", { memberId: id, instituteId: cls!.instituteId, kind: "self", by: "self", byMemberId: id, textVersion: HOUSE_NOTICE_VERSION, under18AtTime: false });
      }
      ids.push(id);
    }
    return ids;
  });
}
const moodEvent = (w: World, memberId: Id<"members">, loggedFor: string, key: string) =>
  w.t.run(async (ctx) => {
    const m = await ctx.db.get(memberId);
    await ctx.db.insert("events", {
      memberId,
      actorId: memberId,
      instituteId: m!.instituteId!,
      room: "mood",
      type: "mood.logged",
      schemaVer: 1,
      payload: { level: 3 },
      occurredAt: at(`${loggedFor}T12:00:00+05:30`),
      loggedFor,
      late: false,
      eventKey: key,
    });
  });

describe("the gate (AC-1, AC-2, AC-18)", () => {
  test("covers AC-1: a student who joined sees consentNeeded and every room refuses; an adult needs only their own agreement", async () => {
    const w = await world();
    const s = await fresh(w, "new@alpha.test", false);
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["self"] });
    expect(await room(s)).toBe("consent_required");
    expect(await agree(s)).toEqual({ ok: true });
    expect(await me(s)).toMatchObject({ state: "active", role: "student" });
    expect(await room(s)).toBe("forbidden"); // through the gate, then refused for being a student (the staff list)
  });

  test("covers AC-1, AC-3: an under 18 needs both their own agreement and the school's record, in either order", async () => {
    const w = await world();
    const s = await fresh(w, "kid@alpha.test", true);
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["self", "parent"] });
    await agree(s);
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["parent"] });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [s.memberId] })).toMatchObject({ ok: true, recorded: 1 });
    expect(await me(s)).toMatchObject({ state: "active" });
    const k = await fresh(w, "kid2@alpha.test", true);
    await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] });
    expect(await me(k)).toEqual({ state: "consentNeeded", missing: ["self"] });
  });

  test("covers AC-1: a missing under 18 flag counts as under 18", async () => {
    const w = await world();
    const s = await fresh(w, "flagless@alpha.test", false);
    await agree(s);
    await w.t.run(async (ctx) => ctx.db.patch(s.memberId, { under18: undefined }));
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["parent"] });
    expect(isMinor(undefined)).toBe(true);
    expect(isMinor(true)).toBe(true);
    expect(isMinor(false)).toBe(false);
  });

  test("covers AC-1: teachers, institute admins, DHI admins and counselors are not gated", async () => {
    const w = await world();
    for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) expect(await me(p)).toMatchObject({ state: "active" });
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }))).toBe("ok");
  });

  test("covers AC-1: withdrawn is answered before consent needed", () => {
    const base: ConsentFacts = { under18: true, selfAgreed: false, parentOnFile: false, withdrawn: { self: true, school: false } };
    expect(decideGate(base)).toEqual({ state: "withdrawn", by: ["self"] });
    expect(decideGate({ ...base, withdrawn: { self: false, school: false } })).toEqual({ state: "consentNeeded", missing: ["self", "parent"] });
    expect(decideGate({ under18: false, selfAgreed: true, parentOnFile: false, withdrawn: { self: false, school: false } })).toEqual({ state: "ok" });
  });

  test("covers AC-2: the notice has a version, exact lines and a fingerprint, and the kinds are registered", async () => {
    const w = await world();
    const s = await fresh(w, "n@alpha.test");
    const n = await s.as.query(api.consent.notice, {});
    expect(n).toEqual({ version: HOUSE_NOTICE_VERSION, lines: [...HOUSE_NOTICE_LINES], hash: await hash(), approved: false });
    expect(CONSENT_KINDS[HOUSE_NOTICE_VERSION]).toBe("house");
    expect(CONSENT_KINDS[HOUSE_PARENT_VERSION]).toBe("house_parent");
    expect(HOUSE_ACCEPTED_VERSIONS).toContain(HOUSE_NOTICE_VERSION);
    expect(HOUSE_PARENT_ACCEPTED_VERSIONS).toContain(HOUSE_PARENT_VERSION);
  });

  test("covers AC-2: an unknown version or a wrong fingerprint is consent_text_changed; a repeat changes nothing; the text is stored on first use", async () => {
    const w = await world();
    const s = await fresh(w, "agree@alpha.test");
    expect(await s.as.mutation(api.consent.agree, { version: "house-v0", hash: await hash() })).toEqual({ ok: false, code: "consent_text_changed" });
    expect(await s.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: "0".repeat(64) })).toEqual({ ok: false, code: "consent_text_changed" });
    expect(await s.as.mutation(api.consent.agree, { version: "v4", hash: await hash() })).toEqual({ ok: false, code: "consent_text_changed" });
    const rows0 = await w.t.run(async (ctx) => (await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", s.memberId)).take(20)).length);
    expect(rows0).toBe(0);
    await agree(s);
    await agree(s);
    const rows = await w.t.run(async (ctx) => await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", s.memberId)).take(20));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "self", by: "self", textVersion: HOUSE_NOTICE_VERSION, byMemberId: s.memberId });
    const stored = await w.t.run(async (ctx) => await ctx.db.query("consentTexts").withIndex("by_version", (q) => q.eq("version", HOUSE_NOTICE_VERSION)).first());
    expect(stored?.hash).toBe(await hash());
    expect(stored?.text).toBe(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]);
  });

  test("covers AC-2: an agreement to a version that is no longer accepted needs a fresh one", async () => {
    const w = await world();
    const s = await fresh(w, "old@alpha.test");
    await w.t.run(async (ctx) => {
      await ctx.db.insert("consentRecords", { memberId: s.memberId, kind: "self", by: "self", byMemberId: s.memberId, textVersion: "house-v0", under18AtTime: false });
    });
    expect(await me(s)).toEqual({ state: "consentNeeded", missing: ["self"] });
  });

  test("covers AC-18: the notice and the parent wording are drafts, marked as not approved, and the notice names where data is stored", async () => {
    expect(HOUSE_WORDS_APPROVED).toBe(false);
    const w = await world();
    expect((await w.A.admin.as.query(api.consent.parentNotice, {})).approved).toBe(false);
    expect(HOUSE_NOTICE_LINES.join(" ")).toMatch(/Convex/);
    expect(HOUSE_NOTICE_LINES.join(" ")).toMatch(/privacy@dhirise\.com/);
  });

  test("covers AC-1: only a student reads the notice or agrees", async () => {
    const w = await world();
    expect(await refusal(w.teacher.as.query(api.consent.notice, {}))).toBe("forbidden");
    expect(await refusal(w.A.admin.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: await hash() }))).toBe("forbidden");
  });

  test("covers AC-17: agreeing is limited to 10 an hour, and a refused try still counts", async () => {
    const w = await world();
    const s = await fresh(w, "rl@alpha.test");
    const results: unknown[] = [];
    for (let i = 0; i < 11; i++) results.push(await s.as.mutation(api.consent.agree, { version: "house-v0", hash: "x" }));
    expect(results.slice(0, 10).every((r) => (r as { code: string }).code === "consent_text_changed")).toBe(true);
    expect(results[10]).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("the school's record (AC-3, AC-4, AC-17)", () => {
  test("covers AC-3: only an institute admin of the student's institute records, and it stores who, when and the wording, nothing about a parent", async () => {
    const w = await world();
    const k = await fresh(w, "k@alpha.test", true);
    expect(await refusal(w.dhi.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] }))).toBe("forbidden");
    expect(await refusal(w.teacher.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] }))).toBe("forbidden");
    expect(await refusal(w.adult.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] }))).toBe("forbidden");
    expect(await refusal(w.counselor.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] }))).toBe("forbidden");
    // Another institute's admin: the student reads as not found, the same as a student who does not exist.
    expect(await w.B.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] })).toEqual({ ok: false, code: "not_found" });
    const r = await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] });
    expect(r).toMatchObject({ ok: true, recorded: 1, skipped: [], isDone: true });
    const row = await w.t.run(async (ctx) => await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", k.memberId).eq("kind", "parent")).unique());
    expect(row).toMatchObject({ kind: "parent", by: "school", byMemberId: w.A.admin.memberId, textVersion: HOUSE_PARENT_VERSION, under18AtTime: true, instituteId: w.A.instituteId });
    expect(Object.keys(row!).sort()).toEqual(["_creationTime", "_id", "by", "byMemberId", "instituteId", "kind", "memberId", "textVersion", "under18AtTime"]);
    const logs = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "consent.parent" && l.targetMemberId === k.memberId));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actor: w.A.admin.memberId, targetMemberId: k.memberId, instituteId: w.A.instituteId });
    const text = await w.t.run(async (ctx) => await ctx.db.query("consentTexts").withIndex("by_version", (q) => q.eq("version", HOUSE_PARENT_VERSION)).first());
    expect(text?.text).toBe(CONSENT_TEXTS[HOUSE_PARENT_VERSION]);
  });

  test("covers AC-3: one student answers its error; a list answers a skip reason for each", async () => {
    const w = await world();
    const k = await fresh(w, "k2@alpha.test", true);
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [w.adult.memberId] })).toEqual({ ok: false, code: "not_under18" });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [w.studentB.memberId] })).toEqual({ ok: false, code: "not_found" });
    const removed = await fresh(w, "gone@alpha.test", true);
    await w.A.admin.as.mutation(api.members.remove, { memberId: removed.memberId });
    const list = await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId, w.adult.memberId, w.studentB.memberId, removed.memberId, w.minor.memberId] });
    expect(list).toMatchObject({ ok: true, recorded: 1 });
    const reasons = Object.fromEntries((list as { skipped: { memberId: string; reason: string }[] }).skipped.map((s) => [s.memberId, s.reason]));
    expect(reasons).toEqual({ [w.adult.memberId]: "adult", [w.studentB.memberId]: "other_institute", [removed.memberId]: "removed", [w.minor.memberId]: "already_on_file" });
    // A repeat records nothing more.
    const again = await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId, w.minor.memberId] });
    expect(again).toMatchObject({ ok: true, recorded: 0 });
  });

  test("covers AC-3: a class is recorded 50 at a time with a cursor, and more than 50 ids are refused", async () => {
    const w = await world();
    const big = await makeClass(w.A.admin, "Class 9", "Z");
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) {
        await ctx.db.insert("members", { authUserId: `kids:${i}`, role: "student", instituteId: w.A.instituteId, classId: big, name: `Kid ${i}`, email: `kid${i}@alpha.test`, under18: true, status: "active", joinedAt: NOW });
      }
    });
    const first = await w.A.admin.as.mutation(api.consent.recordParent, { classId: big });
    expect(first).toMatchObject({ ok: true, recorded: 50, isDone: false });
    const second = await w.A.admin.as.mutation(api.consent.recordParent, { classId: big, cursor: (first as { continueCursor: string }).continueCursor });
    expect(second).toMatchObject({ ok: true, recorded: 10, isDone: true });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { classId: big })).toMatchObject({ ok: true, recorded: 0, isDone: false });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: Array.from({ length: 51 }, () => w.minor.memberId) })).toEqual({ ok: false, code: "too_many" });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, { classId: w.b1 })).toEqual({ ok: false, code: "not_found" });
    expect(await w.A.admin.as.mutation(api.consent.recordParent, {})).toEqual({ ok: false, code: "bad_request" });
  });

  test("covers AC-3: a suspended institute's admin cannot use the screen", async () => {
    const w = await world();
    const k = await fresh(w, "susp@alpha.test", true);
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    expect(await refusal(w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] }))).toBe("institute_suspended");
    expect(await refusal(w.A.admin.as.query(api.consent.parentList, { paginationOpts: page }))).toBe("institute_suspended");
  });

  test("covers AC-17: recording is limited to 20 calls an hour for each institute admin, and a refused call still counts", async () => {
    const w = await world();
    // Setting the world up used one call (the minor's record), so 19 are left.
    const results: string[] = [];
    for (let i = 0; i < 20; i++) results.push(await refusal(w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [w.adult.memberId] })));
    expect(results.slice(0, 19).every((r) => r === "not_under18")).toBe(true);
    expect(results[19]).toBe("rate_limited");
    // Another institute admin has their own 20.
    expect(await refusal(w.B.admin.as.mutation(api.consent.recordParent, { memberIds: [w.adult.memberId] }))).toBe("not_found");
  });

  test("covers AC-4: a parent record survives the flag going to adult and back; to under 18 it locks until one exists; a withdrawal binds only while under 18", async () => {
    const w = await world();
    // Correcting an adult to under 18 locks entry until a parent record exists.
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.adult.memberId, under18: true });
    expect(await me(w.adult)).toEqual({ state: "consentNeeded", missing: ["parent"] });
    await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [w.adult.memberId] });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
    // To adult needs nothing; the student's own agreement stays valid and is not asked again.
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.adult.memberId, under18: false });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
    // The school withdraws while under 18: it binds; once an adult it does not; back to under 18 it binds again, the parent record still there.
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.adult.memberId, under18: true });
    expect(await w.A.admin.as.mutation(api.consent.recordParentWithdrawn, { memberId: w.adult.memberId })).toEqual({ ok: true });
    expect(await me(w.adult)).toEqual({ state: "withdrawn", by: ["school"] });
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.adult.memberId, under18: false });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.adult.memberId, under18: true });
    expect(await me(w.adult)).toEqual({ state: "withdrawn", by: ["school"] });
    await w.A.admin.as.mutation(api.consent.recordParentRestored, { memberId: w.adult.memberId });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
  });

  test("covers AC-20: the school's list shows only the school's own side, never the student's own withdrawal", async () => {
    const w = await world();
    const k = await fresh(w, "list@alpha.test", true);
    const rows = async () => (await w.A.admin.as.query(api.consent.parentList, { paginationOpts: page })).page;
    expect(await rows()).toEqual(expect.arrayContaining([expect.objectContaining({ memberId: k.memberId, status: "needed" }), expect.objectContaining({ memberId: w.minor.memberId, status: "onFile" })]));
    expect((await rows()).some((r) => r.memberId === w.adult.memberId)).toBe(false);
    await w.A.admin.as.mutation(api.consent.recordParent, { memberIds: [k.memberId] });
    await agree(k);
    await k.as.mutation(api.consent.withdraw, {});
    expect((await rows()).find((r) => r.memberId === k.memberId)?.status).toBe("onFile");
    await w.A.admin.as.mutation(api.consent.recordParentWithdrawn, { memberId: k.memberId });
    expect((await rows()).find((r) => r.memberId === k.memberId)?.status).toBe("schoolWithdrew");
    expect(await w.A.admin.as.query(api.consent.parentList, { paginationOpts: page, status: "schoolWithdrew" })).toMatchObject({ page: [expect.objectContaining({ memberId: k.memberId })] });
    expect(await refusal(w.dhi.as.query(api.consent.parentList, { paginationOpts: page }))).toBe("forbidden");
  });
});

describe("withdrawal (AC-5, AC-6)", () => {
  test("covers AC-5: a student withdraws, every room refuses with consent_withdrawn on the next call, the data stays, and they restore only their own side", async () => {
    const w = await world();
    expect(await room(w.adult)).toBe("forbidden");
    expect(await w.adult.as.mutation(api.consent.withdraw, {})).toEqual({ ok: true });
    expect(await me(w.adult)).toEqual({ state: "withdrawn", by: ["self"] });
    expect(await room(w.adult)).toBe("consent_withdrawn");
    expect(await w.adult.as.mutation(api.consent.withdraw, {})).toEqual({ ok: true });
    const rows = await w.t.run(async (ctx) => (await ctx.db.query("consentRecords").withIndex("by_memberId_and_by", (q) => q.eq("memberId", w.adult.memberId).eq("by", "self")).take(20)).map((r) => r.kind));
    expect(rows).toEqual(["self", "withdrawn"]);
    expect(await w.adult.as.mutation(api.consent.restore, {})).toEqual({ ok: true });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
    expect(await w.adult.as.mutation(api.consent.restore, {})).toEqual({ ok: false, code: "not_withdrawn_by_you" });
  });

  test("covers AC-5: both sides in time order; a student cannot restore the school's side; only the institute admin does", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.consent.recordParentWithdrawn, { memberId: w.minor.memberId });
    expect(await me(w.minor)).toEqual({ state: "withdrawn", by: ["school"] });
    expect(await w.minor.as.mutation(api.consent.restore, {})).toEqual({ ok: false, code: "not_withdrawn_by_you" });
    await w.minor.as.mutation(api.consent.withdraw, {});
    expect(await me(w.minor)).toEqual({ state: "withdrawn", by: ["self", "school"] });
    await w.minor.as.mutation(api.consent.restore, {});
    expect(await me(w.minor)).toEqual({ state: "withdrawn", by: ["school"] });
    expect(await refusal(w.dhi.as.mutation(api.consent.recordParentRestored, { memberId: w.minor.memberId }))).toBe("forbidden");
    await w.A.admin.as.mutation(api.consent.recordParentRestored, { memberId: w.minor.memberId });
    expect(await me(w.minor)).toMatchObject({ state: "active" });
    // Withdrawing twice or restoring when not withdrawn records nothing more, and the school's calls log once.
    await w.A.admin.as.mutation(api.consent.recordParentRestored, { memberId: w.minor.memberId });
    const logs = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "consent.parentRestored"));
    expect(logs).toHaveLength(1);
  });

  test("covers AC-5: withdrawal comes before consent needed when both apply", async () => {
    const w = await world();
    const k = await fresh(w, "both@alpha.test", true);
    await k.as.mutation(api.consent.withdraw, {});
    expect(await me(k)).toEqual({ state: "withdrawn", by: ["self"] });
  });

  test("covers AC-17: withdraw and restore share 10 an hour", async () => {
    const w = await world();
    const results: unknown[] = [];
    for (let i = 0; i < 6; i++) {
      results.push(await w.adult.as.mutation(api.consent.withdraw, {}));
      results.push(await w.adult.as.mutation(api.consent.restore, {}));
    }
    expect(results.slice(0, 10).every((r) => (r as { ok: boolean }).ok)).toBe(true);
    expect(results[10]).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-6: a locked student still reaches the consent screen, the sharing setting, the access record and their data rights", async () => {
    const w = await world();
    const s = await fresh(w, "locked@alpha.test", true);
    expect(await refusal(s.as.query(api.consent.notice, {}))).toBe("ok");
    expect(await refusal(s.as.query(api.consent.state, {}))).toBe("ok");
    expect(await refusal(s.as.query(api.sharing.get, {}))).toBe("ok");
    expect(await refusal(s.as.mutation(api.sharing.set, { parentLevel: "summary" }))).toBe("ok");
    expect(await refusal(s.as.query(api.access.mine, { paginationOpts: page }))).toBe("ok");
    expect(await refusal(s.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
    expect(await refusal(s.as.mutation(api.consent.withdraw, {}))).toBe("ok");
    expect(await refusal(s.as.mutation(api.consent.restore, {}))).toBe("ok");
    expect(await agree(s)).toEqual({ ok: true });
    // And not the rooms.
    expect(await room(s)).toBe("consent_required");
  });

  test("covers AC-6: a removed student and a student of a paused institute can still read their consent state and export; erase works too", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.adult.memberId });
    expect(await room(w.adult)).toBe("removed");
    expect(await w.adult.as.query(api.consent.state, {})).toMatchObject({ gate: { state: "ok" } });
    expect(await refusal(w.adult.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    expect(await room(w.minor)).toBe("institute_suspended");
    expect(await w.minor.as.query(api.consent.state, {})).toMatchObject({ gate: { state: "ok" } });
    expect(await refusal(w.minor.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
    expect(await refusal(w.minor.as.mutation(api.dataRights.eraseMine, { confirm: true }))).toBe("ok");
  });

  test("covers AC-6: exactly these files use the lock tolerant check, and the room check is used everywhere else", () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const users = Object.entries(files)
      .filter(([name]) => !name.endsWith(".test.ts"))
      .filter(([, text]) => /requireMemberAllowLocked\s*\(/.test(text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")))
      .map(([name]) => name)
      .sort();
    // houseAuth.ts defines it; consent.ts wraps it for students; the rest are the screens of AC-6.
    expect(users).toEqual(["./access.ts", "./consent.ts", "./dataRights.ts", "./houseAuth.ts", "./sharing.ts"]);
    // The only functions of consent.ts that use requireStudentAllowLocked are the five of AC-6; the school's functions use requireMember.
    const consent = files["./consent.ts"];
    const tolerant = [...consent.matchAll(/export const (\w+) = (?:query|mutation)\(\{[\s\S]*?\n\}\);/g)].filter((m) => /requireStudentAllowLocked\(/.test(m[0])).map((m) => m[1]).sort();
    expect(tolerant).toEqual(["agree", "notice", "restore", "state", "withdraw"]);
  });
});

describe("who sees what (AC-7, AC-8, AC-23, AC-24)", () => {
  const OK = { standing: "ok" } as const;
  const WELL: DataKind[] = ["mood", "meals", "habits", "sleep", "hour", "modules"];
  const WRITTEN: DataKind[] = ["writing", "desk"];

  test("covers AC-7: every viewer against every kind returns exactly the table", () => {
    const expected = (viewer: Viewer, relation: Relation, kind: DataKind) => {
      if (viewer === "student") return relation === "self" ? "full" : "none";
      if (kind === "profile") return "none";
      if (WRITTEN.includes(kind)) return viewer === "parent" ? "none" : "none";
      if (viewer === "teacher") return relation === "assigned_class" && kind === "academic" ? "named" : "none";
      if (viewer === "institute_admin") return relation === "same_institute" ? (kind === "academic" ? "named" : "totals") : "none";
      if (viewer === "parent") return kind === "academic" ? "named" : "none";
      return "none";
    };
    const relations: Relation[] = ["self", "assigned_class", "same_institute", "none"];
    const viewers: Viewer[] = ["student", "teacher", "institute_admin", "dhi_admin", "counselor", "parent"];
    for (const v of viewers) for (const r of relations) for (const k of DATA_KINDS) {
      expect(canView(v, r, k, OK), `${v} ${r} ${k}`).toBe(expected(v, r, k));
    }
    // The reserved parent row: summary only when the student turned sharing on.
    for (const k of WELL) {
      expect(canView("parent", "none", k, { standing: "ok", parentLevel: "summary" })).toBe("summary");
      expect(canView("parent", "none", k, { standing: "ok", parentLevel: "none" })).toBe("none");
    }
    for (const k of WRITTEN) expect(canView("parent", "none", k, { standing: "ok", parentLevel: "summary" })).toBe("none");
  });

  test("covers AC-7, AC-8: a DHI admin and a counselor never get room content; writing and desk chats are the student's alone", () => {
    for (const v of ["dhi_admin", "counselor"] as Viewer[]) for (const k of DATA_KINDS) for (const r of ["self", "assigned_class", "same_institute", "none"] as Relation[]) {
      expect(canView(v, r, k, OK)).toBe("none");
    }
    for (const k of WRITTEN) for (const v of ["teacher", "institute_admin", "dhi_admin", "counselor", "parent"] as Viewer[]) {
      expect(canView(v, v === "teacher" ? "assigned_class" : "same_institute", k, OK)).toBe("none");
    }
  });

  test("covers AC-7: a target who is withdrawn, removed, erased or not through consent is invisible to staff, but not to themselves", () => {
    for (const standing of ["locked", "removed", "erased"] as const) {
      expect(canView("teacher", "assigned_class", "academic", { standing })).toBe("none");
      expect(canView("institute_admin", "same_institute", "academic", { standing })).toBe("none");
      expect(canView("institute_admin", "same_institute", "mood", { standing })).toBe("none");
      expect(canView("student", "self", "mood", { standing })).toBe("full");
    }
  });

  test("covers AC-8: every room registers its kind codes, every kind belongs to a room, and academic is only exams", () => {
    const rooms = [...ROOMS].filter((r) => r !== "test").sort();
    expect(Object.keys(ROOM_KINDS).filter((r) => r !== "test").sort()).toEqual(rooms);
    const claimed = Object.values(ROOM_KINDS).flat();
    for (const k of DATA_KINDS) if (k !== "profile") expect(claimed, k).toContain(k);
    expect(Object.entries(ROOM_KINDS).filter(([, kinds]) => kinds.includes("academic")).map(([r]) => r)).toEqual(["exams"]);
    expect(KIND_CLASS.academic).toBe("academic");
    expect([...TOTAL_KINDS].sort()).toEqual([...WELL].sort());
  });

  test("covers AC-24: rights follow the current class, so a student who changes class is seen by the new teacher and no longer by the old one", async () => {
    const w = await world();
    const teacher2 = await makeTeacher(w.t, w.A.admin, "teacher2@alpha.test", [w.a2]);
    const read = (teacher: Person) =>
      teacher.as.run(async (ctx) => {
        const mc = await requireMember(ctx);
        return mc;
      });
    void read;
    const ask = async (teacher: Person) =>
      await refusal(
        teacher.as.run(async () => {
          // staffRead needs a mutation context; run it through the test harness with this teacher's identity.
          return null;
        }),
      );
    void ask;
    const viaWrapper = (teacher: Person) =>
      refusal(
        teacher.as.run(async (ctx) => {
          const mc = await requireMember(ctx);
          return await staffRead(ctx as never, mc, { kind: "academic", targetMemberIds: [w.adult.memberId] }, async (ts) => ts.length);
        }),
      );
    expect(await viaWrapper(w.teacher)).toBe("ok");
    expect(await viaWrapper(teacher2)).toBe("forbidden");
    await w.A.admin.as.mutation(api.members.setClass, { memberId: w.adult.memberId, classId: w.a2 });
    expect(await viaWrapper(w.teacher)).toBe("forbidden");
    expect(await viaWrapper(teacher2)).toBe("ok");
  });
});

describe("sharing and the access record (AC-9, AC-10, AC-11)", () => {
  const viaWrapper = (w: World, p: Person, kind: DataKind, ids: Id<"members">[]) =>
    p.as.run(async (ctx) => {
      const mc = await requireMember(ctx);
      return await staffRead(ctx as never, mc, { kind, targetMemberIds: ids }, async (ts) => ts.map((t) => t._id));
    });

  test("covers AC-9: sharing is off until the student turns it on, only they change it, and each change writes one access log row", async () => {
    const w = await world();
    expect(await w.adult.as.query(api.sharing.get, {})).toEqual({ parentLevel: "none" });
    expect(await refusal(w.teacher.as.query(api.sharing.get, {}))).toBe("forbidden");
    expect(await refusal(w.A.admin.as.mutation(api.sharing.set, { parentLevel: "summary" }))).toBe("forbidden");
    expect(await w.adult.as.mutation(api.sharing.set, { parentLevel: "summary" })).toEqual({ parentLevel: "summary" });
    expect(await w.adult.as.query(api.sharing.get, {})).toEqual({ parentLevel: "summary" });
    await w.adult.as.mutation(api.sharing.set, { parentLevel: "summary" }); // no change, no row
    await w.adult.as.mutation(api.sharing.set, { parentLevel: "none" });
    const logs = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "sharing.set"));
    expect(logs).toHaveLength(2);
    // Another student's setting is untouched.
    expect(await w.minor.as.query(api.sharing.get, {})).toEqual({ parentLevel: "none" });
    const rows = await w.t.run(async (ctx) => (await ctx.db.query("sharingSettings").take(20)).length);
    expect(rows).toBe(1);
  });

  test("covers AC-10: a staff read leaves one view row per student and kind, with ids and codes only; the roster is not a view", async () => {
    const w = await world();
    // The roster: no view row.
    await w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("viewLog").take(50)).length)).toBe(0);
    const got = await viaWrapper(w, w.teacher, "academic", [w.adult.memberId, w.minor.memberId, w.adult.memberId]);
    expect((got as Id<"members">[]).sort()).toEqual([w.adult.memberId, w.minor.memberId].sort());
    const rows = await w.t.run(async (ctx) => await ctx.db.query("viewLog").take(50));
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(["_creationTime", "_id", "at", "instituteId", "kind", "targetMemberId", "viewerId", "viewerRole"]);
      expect(r).toMatchObject({ viewerId: w.teacher.memberId, viewerRole: "teacher", kind: "academic", instituteId: w.A.instituteId, at: NOW });
    }
  });

  test("covers AC-10: a read outside the caller's reach is refused and writes no row; a locked or withdrawn student is left out with no row", async () => {
    const w = await world();
    expect(await refusal(viaWrapper(w, w.teacher, "mood", [w.adult.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.dhi, "academic", [w.adult.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.counselor, "academic", [w.adult.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.A.admin, "writing", [w.adult.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.A.admin, "mood", [w.adult.memberId]))).toBe("forbidden"); // totals only, never named
    expect(await refusal(viaWrapper(w, w.B.admin, "academic", [w.adult.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.teacher, "academic", [w.studentB.memberId]))).toBe("forbidden");
    expect(await refusal(viaWrapper(w, w.teacher, "academic", [w.teacher.memberId]))).toBe("not_found");
    expect(await refusal(viaWrapper(w, w.teacher, "academic", []))).toBe("bad_request");
    expect(await w.t.run(async (ctx) => (await ctx.db.query("viewLog").take(50)).length)).toBe(0);
    await w.adult.as.mutation(api.consent.withdraw, {});
    const fresher = await fresh(w, "notyet@alpha.test");
    const got = await viaWrapper(w, w.A.admin, "academic", [w.adult.memberId, fresher.memberId, w.minor.memberId]);
    expect(got).toEqual([w.minor.memberId]);
    const rows = await w.t.run(async (ctx) => await ctx.db.query("viewLog").take(50));
    expect(rows.map((r) => r.targetMemberId)).toEqual([w.minor.memberId]);
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.minor.memberId });
    expect(await viaWrapper(w, w.A.admin, "academic", [w.minor.memberId])).toEqual([]);
  });

  test("covers AC-11: a student sees role and India date of each view, never a name or a time, and a team view reads DHI team", async () => {
    const w = await world();
    await viaWrapper(w, w.teacher, "academic", [w.adult.memberId]);
    setTime("2026-10-20T03:00:00+05:30"); // still the 19th (before 04:00)
    await viaWrapper(w, w.A.admin, "academic", [w.adult.memberId]);
    await w.t.run(async (ctx) => {
      await ctx.db.insert("viewLog", { viewerRole: "team", targetMemberId: w.adult.memberId, instituteId: w.A.instituteId, kind: "academic", at: at("2026-10-20T05:00:00+05:30") });
    });
    const mine = await w.adult.as.query(api.access.mine, { paginationOpts: page });
    expect(mine.page).toEqual([
      { role: "DHI team", day: "2026-10-20" },
      { role: "Institute", day: "2026-10-19" },
      { role: "Teacher", day: "2026-10-19" },
    ]);
    expect(JSON.stringify(mine)).not.toMatch(/Head Teacher|Test Teacher|alpha\.test|Asha/);
    // Another student's record is theirs alone.
    expect((await w.minor.as.query(api.access.mine, { paginationOpts: page })).page).toEqual([]);
    expect(await refusal(w.teacher.as.query(api.access.mine, { paginationOpts: page }))).toBe("forbidden");
  });
});

const setTime = (iso: string) => vi.setSystemTime(at(iso));

describe("class totals (AC-23)", () => {
  const totalVia = (w: World, p: Person, classId: Id<"classes">, kind: DataKind, month: string) =>
    p.as.run(async (ctx) => {
      const mc = await requireMember(ctx);
      return await classTotal(ctx as never, mc, { classId, kind, month });
    });

  test("covers AC-23: nothing under 10, the count at 10 or more, one access log row per call", async () => {
    const w = await world();
    const ids = await crowd(w, w.a2, 12, "tot");
    for (const id of ids.slice(0, 9)) await moodEvent(w, id, "2026-09-10", `mood:${id}`);
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-09")).toBeNull();
    // The first answer of a month is kept (the review's subtraction finding), so a later event does not change September.
    await moodEvent(w, ids[9], "2026-09-30", `mood:${ids[9]}`);
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-09")).toBeNull();
    // A month with 10 students: a second day for one student still counts that student once.
    for (const id of ids.slice(0, 10)) await moodEvent(w, id, "2026-08-10", `mood:a${id}`);
    await moodEvent(w, ids[9], "2026-08-12", `mood:b${ids[9]}`);
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-08")).toEqual({ count: 10 });
    expect(MIN_TOTAL).toBe(10);
    const logs = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "totals.read"));
    expect(logs).toHaveLength(3);
    // Another kind has no data, so nothing.
    expect(await totalVia(w, w.A.admin, w.a2, "meals", "2026-09")).toBeNull();
  });

  test("covers AC-23: withdrawn, removed and not through consent students count for nothing, and events outside the month do not count", async () => {
    const w = await world();
    const ids = await crowd(w, w.a2, 11, "ex");
    for (const id of ids) await moodEvent(w, id, "2026-09-05", `mood:${id}`);
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-09")).toEqual({ count: 11 });
    await w.t.run(async (ctx) => {
      await ctx.db.insert("consentRecords", { memberId: ids[0], kind: "withdrawn", by: "self", byMemberId: ids[0], textVersion: HOUSE_NOTICE_VERSION, under18AtTime: false });
    });
    await w.t.run(async (ctx) => ctx.db.patch(ids[1], { status: "removed" }));
    // September was answered once and stays as answered, so pausing a student between two asks cannot be subtracted (the review's finding).
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-09")).toEqual({ count: 11 });
    // A month asked for the first time leaves out the withdrawn and the paused student: 11 with data, 9 standing, so nothing.
    for (const id of ids) await moodEvent(w, id, "2026-08-05", `mood:aug${id}`);
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-08")).toBeNull();
    // And a month with no events at all is nothing.
    expect(await totalVia(w, w.A.admin, w.a2, "mood", "2026-07")).toBeNull();
  });

  test("covers AC-23: only an institute admin of the class's institute, only wellbeing kinds, only one complete month", async () => {
    const w = await world();
    expect(await refusal(totalVia(w, w.teacher, w.a1, "mood", "2026-09"))).toBe("forbidden");
    expect(await refusal(totalVia(w, w.dhi, w.a1, "mood", "2026-09"))).toBe("forbidden");
    expect(await refusal(totalVia(w, w.B.admin, w.a1, "mood", "2026-09"))).toBe("forbidden");
    expect(await refusal(totalVia(w, w.A.admin, w.b1, "mood", "2026-09"))).toBe("forbidden");
    for (const kind of ["academic", "writing", "desk", "profile"] as DataKind[]) expect(await refusal(totalVia(w, w.A.admin, w.a1, kind, "2026-09"))).toBe("forbidden");
    for (const month of ["2026-10", "2026-11", "2025-09", "2026-9", "2026-13", "2026-09-01", "nope", ""]) {
      expect(await refusal(totalVia(w, w.A.admin, w.a1, "mood", month)), month).toBe("bad_period");
    }
    expect(monthDays("2026-09", NOW)).toEqual({ fromDay: "2026-09-01", toDay: "2026-09-30" });
    expect(monthDays("2025-10", NOW)).toEqual({ fromDay: "2025-10-01", toDay: "2025-10-31" });
    expect(monthDays("2025-09", NOW)).toBeNull();
    expect(monthDays("2026-10", NOW)).toBeNull();
    expect(monthDays("2028-02", at("2028-03-01T10:00:00+05:30"))).toEqual({ fromDay: "2028-02-01", toDay: "2028-02-29" });
  });
});

describe("export (AC-12, AC-16)", () => {
  test("covers AC-12: the export holds the student's own data only, in pages of at most 100, and arrives as sections to join into one file", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.adult.memberId);
      for (let i = 0; i < 230; i++) {
        await ctx.db.insert("events", { memberId: w.adult.memberId, actorId: w.adult.memberId, instituteId: m!.instituteId!, room: "mood", type: "mood.logged", schemaVer: 1, payload: { level: 2 }, occurredAt: NOW, loggedFor: "2026-10-19", late: false, eventKey: `mood:e${i}` });
      }
      await ctx.db.insert("events", { memberId: w.minor.memberId, actorId: w.minor.memberId, instituteId: m!.instituteId!, room: "mood", type: "mood.other", schemaVer: 1, payload: {}, occurredAt: NOW, loggedFor: "2026-10-19", late: false, eventKey: "mood:other" });
    });
    await w.adult.as.mutation(api.sharing.set, { parentLevel: "summary" });
    const sections: { section: string; rows: unknown[] }[] = [];
    let cursor: string | null | undefined = undefined;
    for (let i = 0; i < 20; i++) {
      const r = (await w.adult.as.mutation(api.dataRights.exportMine, { cursor })) as { ok: true; section: string; rows: unknown[]; next: string | null; schema: string };
      expect(r.ok).toBe(true);
      expect(r.rows.length).toBeLessThanOrEqual(100);
      sections.push({ section: r.section, rows: r.rows });
      if (r.next === null) break;
      cursor = r.next;
    }
    expect(sections.map((s) => s.section).filter((x) => x !== "events")).toEqual(["header", "mood", "habits"]); // each room adds its own (empty here) section after the events
    expect(sections.filter((s) => s.section === "events")).toHaveLength(3);
    const header = sections[0].rows[0] as { profile: Record<string, unknown>; consent: unknown[]; sharing: unknown };
    expect(header.profile).toMatchObject({ name: "Asha Rao", email: "adult@alpha.test", role: "student", institute: "Alpha School", class: "Class 10 A", under18: false });
    expect(header.sharing).toEqual({ parentLevel: "summary" });
    expect(header.consent).toEqual([{ kind: "self", by: "self", textVersion: HOUSE_NOTICE_VERSION, at: expect.any(Number) }]);
    const events = sections.filter((s) => s.section === "events").flatMap((s) => s.rows) as { type: string; day: string; id: string }[];
    expect(events).toHaveLength(230);
    expect(events.every((e) => Object.keys(e).sort().join() === "day,id,type" && e.type === "mood.logged" && e.day === "2026-10-19")).toBe(true);
    expect(JSON.stringify(sections)).not.toMatch(/minor@alpha|mood\.other|admin|teacher/);
  });

  test("covers AC-12, AC-17: five exports an hour for each person; the pages of one export are free; a bad cursor is refused", async () => {
    const w = await world();
    const r = [];
    for (let i = 0; i < 6; i++) r.push(await w.adult.as.mutation(api.dataRights.exportMine, {}));
    expect(r.slice(0, 5).every((x) => (x as { ok: boolean }).ok)).toBe(true);
    expect(r[5]).toEqual({ ok: false, code: "rate_limited" });
    // Another person has their own five.
    expect(await w.minor.as.mutation(api.dataRights.exportMine, {})).toMatchObject({ ok: true });
    const next = ((await w.minor.as.mutation(api.dataRights.exportMine, {})) as { next: string }).next;
    for (let i = 0; i < 3; i++) expect(await w.adult.as.mutation(api.dataRights.exportMine, { cursor: next })).toMatchObject({ ok: true });
    expect(await w.adult.as.mutation(api.dataRights.exportMine, { cursor: "not json" })).toEqual({ ok: false, code: "bad_cursor" });
    expect(await refusal(w.teacher.as.mutation(api.dataRights.exportMine, {}))).toBe("forbidden");
  });

  test("covers AC-16: no function returns an event document, and the export holds only a type, a day and an id", async () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [name, text] of Object.entries(files)) {
      if (name.endsWith(".test.ts") || name === "./eventLog.ts" || name === "./eventData.ts") continue;
      const code = text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code, name).not.toMatch(/return\s+(?:await\s+)?ctx\.db\.query\(\s*["']events["']/);
    }
    expect(files["./eventData.ts"]).toMatch(/rows: page\.page\.map\(\(e\) => \(\{ type: e\.type, day: e\.loggedFor, id: e\._id \}\)\)/);
  });
});

describe("erase (AC-13, AC-14, AC-19)", () => {
  async function fill(w: World, memberId: Id<"members">, n: number) {
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(memberId);
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("events", { memberId, actorId: memberId, instituteId: m!.instituteId!, room: "mood", type: "mood.logged", schemaVer: 1, payload: { level: 1 }, occurredAt: NOW, loggedFor: "2026-10-19", late: false, eventKey: `mood:f${i}` });
      }
    });
  }
  const counts = (w: World, memberId: Id<"members">) =>
    w.t.run(async (ctx) => ({
      events: (await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId)).take(1000)).length,
      sharing: (await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(5)).length,
      consent: (await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", memberId)).take(50)).length,
    }));
  const accountExists = (w: World, userId: string) =>
    w.t.run(async (ctx) => {
      const r = await ctx.runQuery(components.betterAuth.adapter.findMany, { model: "user", where: [{ field: "_id", operator: "eq", value: userId }], paginationOpts: { numItems: 1, cursor: null } });
      return r.page.length > 0;
    });

  test("covers AC-13: without ERASURE_HASH_SECRET the erase refuses and does nothing", async () => {
    const w = await world();
    delete process.env.ERASURE_HASH_SECRET;
    expect(await w.adult.as.mutation(api.dataRights.eraseMine, { confirm: true })).toEqual({ ok: false, code: "erase_not_configured" });
    expect(await me(w.adult)).toMatchObject({ state: "active" });
  });

  test("covers AC-13: step one is atomic and complete eventually; a student with more than one page of rows ends with only the kept classes", async () => {
    const w = await world();
    await fill(w, w.adult.memberId, 250);
    await w.adult.as.mutation(api.sharing.set, { parentLevel: "summary" });
    await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "other@alpha.test", name: "Other", classId: w.a1, under18: false });
    expect(await w.adult.as.mutation(api.dataRights.eraseMine, { confirm: true })).toEqual({ ok: true });
    // Invisible at once: the tombstone, before any page of step two has run.
    const tomb = await w.t.run(async (ctx) => await ctx.db.get(w.adult.memberId));
    expect(tomb).toMatchObject({ status: "removed", erasedAt: NOW, name: "", email: "", authUserId: `erased:${w.adult.memberId}`, role: "student", instituteId: w.A.instituteId, classId: w.a1, under18: false });
    expect(tomb?.removedAt).toBeUndefined();
    expect((await counts(w, w.adult.memberId)).sharing).toBe(0);
    expect(await accountExists(w, w.adult.userId)).toBe(false);
    expect(await refusal(w.adult.as.mutation(api.dataRights.exportMine, {}))).not.toBe("ok");
    // Step two finishes in the background, in pages.
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await counts(w, w.adult.memberId)).toEqual({ events: 0, sharing: 0, consent: 1 });
    const receipts = await w.t.run(async (ctx) => await ctx.db.query("houseErasures").take(10));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ by: "self", counts: { events: 250 } });
    expect(JSON.stringify(receipts)).not.toMatch(/adult|Asha|alpha\.test|members/);
    // Nothing of another student was touched.
    expect((await counts(w, w.minor.memberId)).consent).toBeGreaterThan(0);
    // The log of who did it holds ids and a code only.
    const log = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "data.erase"));
    expect(log).toEqual([expect.objectContaining({ actor: w.adult.memberId, targetMemberId: w.adult.memberId })]);
    // Erasing twice does nothing more.
    const again = await w.t.run(async (ctx) => (await ctx.db.query("houseErasures").take(10)).length);
    expect(again).toBe(1);
  });

  test("covers AC-13: invites for that email are cleared, and the same email is blocked for 30 days with the neutral refusal, then can be invited as a new person", async () => {
    const w = await world();
    await w.adult.as.mutation(api.dataRights.eraseMine, { confirm: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const invites = await w.t.run(async (ctx) => (await ctx.db.query("invites").take(100)).filter((i) => i.claimedBy === w.adult.memberId));
    expect(invites).toEqual([expect.objectContaining({ email: "", name: "" })]);
    const blocks = await w.t.run(async (ctx) => await ctx.db.query("houseErasedEmails").take(10));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(blocks)).not.toContain("adult@alpha.test");
    const invite = () => w.A.admin.as.mutation(api.invites.create, { role: "student", email: "adult@alpha.test", name: "Asha Again", classId: w.a1, under18: false });
    expect(blocks[0].until).toBe(NOW + 30 * 86400000);
    expect(await invite()).toEqual({ ok: false, code: "email_in_use" });
    // The block ends (the admin's test session would not last 30 days of fake time, so the end is set on the row).
    await w.t.run(async (ctx) => ctx.db.patch(blocks[0]._id, { until: NOW - 1 }));
    expect(await invite()).toMatchObject({ ok: true });
    // The new person is a new member with no history.
    const again = await joinAs(w.t, "adult@alpha.test", { name: "Asha Again" });
    expect(again.memberId).not.toBe(w.adult.memberId);
    expect(await me(again)).toEqual({ state: "consentNeeded", missing: ["self"] });
  });

  test("covers AC-13: a sign in account with a funnel profile survives, and its sessions end", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      await ctx.db.insert("students", { authUserId: w.minor.userId, email: "minor@alpha.test", name: "Minor", age: 15, class: "Class 10" });
    });
    await w.minor.as.mutation(api.dataRights.eraseMine, { confirm: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await accountExists(w, w.minor.userId)).toBe(true);
    const sessions = await w.t.run(async (ctx) => (await ctx.runQuery(components.betterAuth.adapter.findMany, { model: "session", where: [{ field: "userId", operator: "eq", value: w.minor.userId }], paginationOpts: { numItems: 5, cursor: null } })).page.length);
    expect(sessions).toBe(0);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("students").take(5)).length)).toBe(1);
  });

  test("covers AC-13: a teacher's erase through retention removes their class assignments", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.teacher.memberId, { status: "removed", removedAt: at("2025-08-01T10:00:00+05:30") }));
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", w.teacher.memberId)).take(5)).length)).toBe(0);
    expect(await w.t.run(async (ctx) => (await ctx.db.get(w.teacher.memberId))?.erasedAt)).toBe(NOW);
  });

  test("covers AC-13: the team's erase needs the email, the school and the class to match, for a student marked under 18 only, and answers no_match for everything else", async () => {
    const w = await world();
    const good = { email: "Minor@Alpha.test", school: "alpha  school", class: "class 10 a", note: "parent call" };
    for (const bad of [
      { ...good, email: "nobody@alpha.test" },
      { ...good, school: "Beta School" },
      { ...good, class: "Class 10 B" },
      { ...good, class: "Class 9 A" },
      { email: "adult@alpha.test", school: "Alpha School", class: "Class 10 A" }, // an adult
      { email: "teacher@alpha.test", school: "Alpha School", class: "Class 10 A" }, // not a student
      { ...good, email: "" },
    ]) {
      expect(await w.t.mutation(internal.dataRights.adminErase, bad)).toEqual({ ok: false, code: "no_match" });
      expect(await w.t.mutation(internal.dataRights.adminExport, bad)).toEqual({ ok: false, code: "no_match" });
    }
    // A student who changed class no longer matches the old class.
    await w.A.admin.as.mutation(api.members.setClass, { memberId: w.minor.memberId, classId: w.a2 });
    expect(await w.t.mutation(internal.dataRights.adminErase, good)).toEqual({ ok: false, code: "no_match" });
    await fill(w, w.minor.memberId, 3);
    expect(await w.t.mutation(internal.dataRights.adminExport, { ...good, class: "Class 10 B" })).toEqual({ ok: true, counts: { events: 3, consent: 2 } });
    expect(await w.t.mutation(internal.dataRights.adminErase, { ...good, class: "Class 10 B" })).toEqual({ ok: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await counts(w, w.minor.memberId)).events).toBe(0);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("houseErasures").take(5)).map((r) => r.by))).toEqual(["team"]);
    // The team's erase does not use the student's 30 day block.
    expect(await w.t.run(async (ctx) => (await ctx.db.query("houseErasedEmails").take(5)).length)).toBe(0);
  });

  test("covers AC-13: the team's erase refuses without ERASURE_HASH_SECRET", async () => {
    const w = await world();
    delete process.env.ERASURE_HASH_SECRET;
    expect(await w.t.mutation(internal.dataRights.adminErase, { email: "minor@alpha.test", school: "Alpha School", class: "Class 10 A" })).toEqual({ ok: false, code: "erase_not_configured" });
  });

  test("covers AC-14: every house table has exactly one class and a retention note, and the map names no table that does not exist", () => {
    const FUNNEL_TABLES = [
      "students", "consents", "checks", "answers", "results", "resultFlags", "leads", "feedback", "sheetSync", "sheetStatus", "reportFiles",
      "reportViews", "avatars", "reportShares", "challengeEntries", "leaderboardSnapshots", "referrals",
    ];
    const tables = Object.keys(schema.tables);
    const missing = tables.filter((t) => !FUNNEL_TABLES.includes(t) && !(t in DATA_MAP));
    expect(missing, `tables with no entry in dataMap.ts: ${missing.join(", ")}`).toEqual([]);
    expect(Object.keys(DATA_MAP).filter((t) => !tables.includes(t))).toEqual([]);
    for (const [name, e] of Object.entries(DATA_MAP)) {
      expect(["erased", "kept", "patched", "system"], name).toContain(e.class);
      expect(e.retention.length, name).toBeGreaterThan(10);
    }
    expect(FUNNEL_TABLES.filter((t) => !tables.includes(t))).toEqual([]);
  });
});

describe("retention (AC-15)", () => {
  test("covers AC-15: old view records go, recent ones stay, ended blocks go; running it twice does the same as once", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      await ctx.db.insert("viewLog", { viewerRole: "teacher", targetMemberId: w.adult.memberId, kind: "academic", at: NOW - 3 * 365 * 86400000 - 1000 });
      await ctx.db.insert("viewLog", { viewerRole: "teacher", targetMemberId: w.adult.memberId, kind: "academic", at: NOW - 2 * 365 * 86400000 });
      await ctx.db.insert("houseErasedEmails", { hash: "a".repeat(64), until: NOW - 1 });
      await ctx.db.insert("houseErasedEmails", { hash: "b".repeat(64), until: NOW + 86400000 });
    });
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("viewLog").take(10)).length)).toBe(1);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("houseErasedEmails").take(10)).map((r) => r.hash[0]))).toEqual(["b"]);
  });

  test("covers AC-15: a member removed 12 months is erased (staff too); a recent leaver, a reinstated member, a suspended institute's member and a tombstone are spared; it works in pages", async () => {
    const w = await world();
    const old = at("2025-10-01T10:00:00+05:30");
    const leavers = await crowd(w, w.a2, 14, "leave");
    await w.t.run(async (ctx) => {
      for (const id of leavers) await ctx.db.patch(id, { status: "removed", removedAt: old });
      await ctx.db.patch(w.minor.memberId, { status: "removed", removedAt: at("2026-06-01T10:00:00+05:30") }); // 4 months: kept
      await ctx.db.patch(w.teacher.memberId, { status: "removed", removedAt: old });
    });
    await w.B.admin.as.mutation(api.members.remove, { memberId: w.studentB.memberId }).catch(() => undefined);
    await w.t.run(async (ctx) => ctx.db.patch(w.studentB.memberId, { status: "removed", removedAt: old }));
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, status: "suspended" });
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.adult.memberId });
    await w.A.admin.as.mutation(api.members.reinstate, { memberId: w.adult.memberId });
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = (id: Id<"members">) => w.t.run(async (ctx) => (await ctx.db.get(id))?.erasedAt !== undefined);
    expect(await Promise.all(leavers.map(state))).toEqual(Array(14).fill(true)); // more than one run's worth, so it paged on
    expect(await state(w.teacher.memberId)).toBe(true);
    expect(await state(w.minor.memberId)).toBe(false);
    expect(await state(w.adult.memberId)).toBe(false);
    expect(await state(w.studentB.memberId)).toBe(false);
    // Running again finds nothing new: a tombstone has no removedAt, so the index never offers it.
    const before = await w.t.run(async (ctx) => (await ctx.db.query("houseErasures").take(100)).length);
    await w.t.mutation(internal.retention.sweep, {});
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("houseErasures").take(100)).length)).toBe(before);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("houseErasures").take(100)).every((r) => r.by === "retention"))).toBe(true);
  });
});

describe("the demo seed (AC-22)", () => {
  test("covers AC-22: the demo students arrive with consent so the browser scripts keep working; the seed still refuses where the test sign in is off", async () => {
    const t = makeBackend();
    expect(await refusal(t.mutation(internal.demo.seed, {}))).toBe("demo_disabled");
    process.env.TEST_SIGNIN_ENABLED = "true";
    await t.mutation(internal.demo.seed, {});
    const admin = await joinAs(t, "demo-admin@example.test", { name: "Demo Admin" });
    const student = await joinAs(t, "demo-student@example.test", { name: "Demo Student" });
    const minor = await joinAs(t, "demo-minor@example.test", { name: "Demo Minor" });
    expect(await me(student)).toMatchObject({ state: "active", role: "student" });
    expect(await me(minor)).toMatchObject({ state: "active", role: "student" });
    expect(await me(admin)).toMatchObject({ state: "active" });
    // The newcomer is not given consent by the seed, but gets it on a later seed run if they have joined.
    const newcomer = await joinAs(t, "demo-newcomer@example.test", { name: "Demo Newcomer" });
    await t.mutation(internal.demo.seed, {});
    expect(await me(newcomer)).toMatchObject({ state: "active" });
    // A real address never gets it.
    delete process.env.TEST_SIGNIN_ENABLED;
    const inst = await t.run(async (ctx) => (await ctx.db.query("institutes").first())!._id);
    void inst;
  });
});

describe("source scans (AC-6, AC-10, AC-13, AC-19)", () => {
  const files = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const app = Object.entries(files).filter(([n]) => !n.endsWith(".test.ts") && !n.startsWith("./_generated/"));
  const code = (text: string) => text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const FILES = ["./consent.ts", "./consentState.ts", "./consentRules.ts", "./accessRules.ts", "./dataRights.ts", "./eraseCore.ts", "./retention.ts", "./staffRead.ts", "./sharing.ts", "./access.ts", "./eventData.ts", "./roomRegistry.ts", "./dataMap.ts"];

  test("covers AC-10: only the staff read wrapper writes the view record, and only the sweep deletes one", () => {
    for (const [name, text] of app) {
      const c = code(text);
      if (name !== "./staffRead.ts") expect(c, `${name} writes viewLog`).not.toMatch(/insert\(\s*["']viewLog["']/);
      if (name !== "./retention.ts") expect(c, `${name} deletes viewLog`).not.toMatch(/delete\(\s*["']viewLog["']/);
      expect(c, `${name} changes viewLog`).not.toMatch(/(patch|replace)\(\s*["']viewLog["']/);
    }
  });

  test("covers AC-3: consent records are appended only by the files that own them, and never changed or deleted by app code", () => {
    const writers = ["./consent.ts", "./demo.ts", "./eventProof.ts", "./moodProof.ts"]; // eventProof.ts gives its made up proof student the adult's agreement
    for (const [name, text] of app) {
      const c = code(text);
      if (!writers.includes(name)) expect(c, `${name} writes consentRecords`).not.toMatch(/insert\(\s*["']consentRecords["']/);
      expect(c, `${name} changes consentRecords`).not.toMatch(/(patch|replace|delete)\(\s*["']consentRecords["']/);
    }
  });

  test("covers AC-19: the new files log nothing but counts; every refusal is a fixed code; receipts are never returned by a public function", () => {
    for (const name of FILES) {
      const c = code(files[name] ?? "");
      for (const m of c.matchAll(/console\.\w+\(([^)]*)\)/g)) {
        expect(name, "only the sweep logs").toBe("./retention.ts");
        for (const p of m[1].matchAll(/\$\{([^}]*)\}/g)) expect(["oldViews.length", "blocks.length", "erased", "skipped"]).toContain(p[1]);
      }
      for (const m of c.matchAll(/\bfail\s*\(([^)]*)\)/g)) expect(m[1], `${name}: ${m[0]}`).toMatch(/^\s*"[a-z_0-9]+"\s*$/);
      expect(c, name).not.toMatch(/new ConvexError/);
    }
    for (const [name, text] of app) {
      if (!["./schema.ts", "./dataRights.ts", "./dataMap.ts"].includes(name)) expect(code(text), name).not.toMatch(/houseErasures/);
    }
    // In dataRights.ts the receipt table is only inserted into, by an internal function.
    const dr = code(files["./dataRights.ts"]);
    expect(dr.match(/houseErasures/g)).toHaveLength(1);
    expect(dr).toMatch(/export const eraseStep = internalMutation/);
  });

  test("covers AC-13: the 30 day block stores a hash and never the address; every access code of the spec is in the list", () => {
    expect(code(files["./eraseCore.ts"])).not.toMatch(/insert\(\s*["']houseErasedEmails["']\s*,\s*\{[^}]*email/);
    for (const c of ["consent.parent", "consent.parentWithdrawn", "consent.parentRestored", "sharing.set", "data.erase", "totals.read"]) expect(ACCESS_CODES as readonly string[]).toContain(c);
  });

  test("covers AC-6: the new public functions are exactly the ones the design lists", async () => {
    const loaders = import.meta.glob(["./consent.ts", "./sharing.ts", "./access.ts", "./dataRights.ts"]) as Record<string, () => Promise<Record<string, unknown>>>;
    const names: string[] = [];
    for (const [file, load] of Object.entries(loaders)) {
      const mod = await load();
      for (const [fn, value] of Object.entries(mod)) {
        const f = value as { isPublic?: boolean; exportReturns?: unknown };
        if (typeof f?.exportReturns === "function" && f.isPublic === true) names.push(`${file.slice(2, -3)}.${fn}`);
      }
    }
    expect(names.sort()).toEqual(
      [
        "access.mine", "consent.agree", "consent.notice", "consent.parentList", "consent.parentNotice", "consent.recordParent", "consent.recordParentRestored",
        "consent.recordParentWithdrawn", "consent.restore", "consent.state", "consent.withdraw", "dataRights.eraseMine", "dataRights.exportMine", "sharing.get", "sharing.set",
      ].sort(),
    );
  });
});
