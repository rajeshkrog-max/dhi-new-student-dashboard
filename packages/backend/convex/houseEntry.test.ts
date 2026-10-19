// The Join step and the entry states of the house (spec house/0002). Each test names the criterion it covers.
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { CONSENT_TEXTS, HOUSE_NOTICE_VERSION, consentHash } from "./consentText";
import { finishedStudent, goodConsent, makeBackend, signInAs } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, refusal } from "../tests/houseTestUtils";

afterEach(() => {
  delete process.env.TEST_SIGNIN_ENABLED;
});

const counts = (t: ReturnType<typeof makeBackend>) =>
  t.run(async (ctx) => ({
    members: (await ctx.db.query("members").collect()).length,
    students: (await ctx.db.query("students").collect()).length,
    checks: (await ctx.db.query("checks").collect()).length,
    consents: (await ctx.db.query("consents").collect()).length,
  }));

describe("the first DHI admin (AC-1)", () => {
  test("covers AC-1: the owner's bootstrap makes an invite, the person presses Join and is a DHI admin with no institute", async () => {
    const t = makeBackend();
    await t.mutation(internal.bootstrap.dhiAdmin, { email: "Owner@Example.com", name: "Owner" });
    const s = await signInAs(t, { email: "owner@example.com" });
    expect(await s.as.query(api.members.me, {})).toEqual({ state: "invitePending", role: "dhi_admin", instituteName: null });
    expect((await counts(t)).members).toBe(0);
    await s.as.mutation(api.members.claimInvite, {});
    const me = await s.as.query(api.members.me, {});
    expect(me).toMatchObject({ state: "active", role: "dhi_admin", instituteName: null, className: null });
    // The staff area works: a DHI admin lists institutes.
    expect((await s.as.query(api.institutes.list, { paginationOpts: { numItems: 25, cursor: null } })).page).toEqual([]);
  });

  test("covers AC-1: run twice for the same address it answers email_in_use", async () => {
    const t = makeBackend();
    await t.mutation(internal.bootstrap.dhiAdmin, { email: "owner@example.com", name: "Owner" });
    expect(await refusal(t.mutation(internal.bootstrap.dhiAdmin, { email: "owner@example.com", name: "Owner" }))).toBe("email_in_use");
  });

  test("covers AC-1: the bootstrap and the demo seed are internal functions, so no browser can call them", async () => {
    const sources = import.meta.glob("./{bootstrap,demo}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(sources)).toHaveLength(2);
    for (const source of Object.values(sources)) {
      expect(source).toMatch(/internalMutation\(/);
      // No public `mutation({` or `query({` registration: only the internal kind exists in these two files.
      expect(source).not.toMatch(/(^|[^a-zA-Z])(mutation|query|action)\(\{/m);
    }
  });
});

describe("the entry states (AC-2, AC-3)", () => {
  test("covers AC-2: a DHI admin creates an institute and its first admin's invite, who joins and sees only that institute", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const a = await makeInstitute(t, owner, "Alpha School", "head@alpha.test");
    await makeInstitute(t, owner, "Beta School", "head@beta.test");
    expect(await a.admin.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "institute_admin", instituteName: "Alpha School" });
    // They cannot even ask for the other institute's classes.
    const all = await owner.as.query(api.institutes.list, { paginationOpts: { numItems: 25, cursor: null } });
    const beta = all.page.find((i) => i.name === "Beta School");
    expect(await refusal(a.admin.as.query(api.classes.list, { paginationOpts: { numItems: 25, cursor: null }, instituteId: beta!._id }))).toBe("forbidden");
  });

  test("covers AC-3: a signed in person with no invite and no membership is turned away and nothing is made", async () => {
    const t = makeBackend();
    const s = await signInAs(t, { email: "stranger@example.com" });
    expect(await s.as.query(api.members.me, {})).toEqual({ state: "noHouse" });
    expect(await refusal(s.as.mutation(api.members.claimInvite, {}))).toBe("no_invite");
    expect((await counts(t)).members).toBe(0);
    expect(await refusal(s.as.query(api.members.list, { paginationOpts: { numItems: 25, cursor: null } }))).toBe("not_a_member");
  });

  test("covers AC-3: a funnel student keeps full funnel access and is simply not in a house", async () => {
    const t = makeBackend();
    const s = await finishedStudent(t);
    expect(await s.as.query(api.members.me, {})).toEqual({ state: "noHouse" });
    expect(await s.as.query(api.students.me, {})).toMatchObject({ state: "ready" });
    expect((await counts(t)).members).toBe(0);
  });

  test("covers AC-3: a person with a pending invite sees the institute and role, and nothing is created until they press Join", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner, "Alpha School", "head@alpha.test");
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "asha@alpha.test", name: "Asha", classId, under18: false });
    const before = await counts(t);
    const s = await signInAs(t, { email: "asha@alpha.test" });
    expect(await s.as.query(api.members.me, {})).toEqual({ state: "invitePending", role: "student", instituteName: "Alpha School" });
    expect(await counts(t)).toEqual(before);
    await s.as.mutation(api.members.claimInvite, {});
    // A student who has joined is at the consent gate until they agree (spec house/0005, AC-1); the entry check passes after that.
    expect(await s.as.query(api.members.me, {})).toEqual({ state: "consentNeeded", missing: ["self"] });
    expect(await counts(t)).toEqual({ ...before, members: before.members + 1 });
    await s.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: await consentHash(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]) });
    expect(await s.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "student", className: "Class 10 A" });
  });

  test("covers AC-3: a signed out caller gets signedOut, never an error", async () => {
    const t = makeBackend();
    expect(await t.query(api.members.me, {})).toEqual({ state: "signedOut" });
  });
});

describe("joining (AC-5, AC-6)", () => {
  test("covers AC-5: Join makes a members row and nothing else, and leaves the funnel's rows alone", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "asha@greenfield.test", name: "Asha Rao", classId, under18: true });
    // The same person already has a funnel profile, a check and a consent.
    const s = await signInAs(t, { email: "asha@greenfield.test" });
    await s.as.mutation(api.students.createProfile, { name: "Asha Rao", age: 15, class: "Class 10", guardianPresent: true, consent: await goodConsent() });
    const before = await counts(t);
    const funnel = await t.run(async (ctx) => await ctx.db.query("students").collect());
    await s.as.mutation(api.members.claimInvite, {});
    expect(await counts(t)).toEqual({ ...before, members: before.members + 1 });
    expect(await t.run(async (ctx) => await ctx.db.query("students").collect())).toEqual(funnel);
    // The under 18 flag is the class list's, not the funnel's age (here both agree, so check it is on the member row).
    const member = await t.run(async (ctx) => await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", s.userId)).unique());
    expect(member?.under18).toBe(true);
  });

  test("covers AC-6: an unverified Google email cannot claim", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "asha@greenfield.test", name: "Asha", classId, under18: false });
    const s = await signInAs(t, { email: "asha@greenfield.test", emailVerified: false });
    expect(await refusal(s.as.mutation(api.members.claimInvite, {}))).toBe("email_not_verified");
    expect((await s.as.query(api.members.me, {})).state).toBe("invitePending");
  });

  test("covers AC-6: a test sign in may claim only for an @example.test address, only where the test sign in is on, and never a DHI admin or counselor invite", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "kid@example.test", name: "Kid", classId, under18: false });
    await admin.as.mutation(api.invites.create, { role: "student", email: "kid@example.com", name: "Kid Two", classId, under18: false });
    await t.mutation(internal.bootstrap.dhiAdmin, { email: "boss@example.test", name: "Boss" });
    await owner.as.mutation(api.invites.create, { role: "counselor", email: "counsel@example.test", name: "Counsel" });

    // Test sign in off: refused even for the test address.
    const kidOff = await signInAs(t, { email: "kid@example.test", emailVerified: false });
    expect(await refusal(kidOff.as.mutation(api.members.claimInvite, {}))).toBe("email_not_verified");

    process.env.TEST_SIGNIN_ENABLED = "true";
    expect(await refusal(kidOff.as.mutation(api.members.claimInvite, {}))).toBe("ok");
    const other = await signInAs(t, { email: "kid@example.com", emailVerified: false });
    expect(await refusal(other.as.mutation(api.members.claimInvite, {}))).toBe("email_not_verified");
    const boss = await signInAs(t, { email: "boss@example.test", emailVerified: false });
    expect(await refusal(boss.as.mutation(api.members.claimInvite, {}))).toBe("email_not_verified");
    const counsel = await signInAs(t, { email: "counsel@example.test", emailVerified: false });
    expect(await refusal(counsel.as.mutation(api.members.claimInvite, {}))).toBe("email_not_verified");
  });

  test("covers AC-6: an expired, a revoked and a differently addressed invite are refused", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    const make = async (email: string) => {
      const r = await admin.as.mutation(api.invites.create, { role: "student", email, name: "Kid", classId, under18: false });
      if (!r.ok) throw new Error(r.code);
      return r.inviteId;
    };
    const expiredId = await make("old@greenfield.test");
    const revokedId = await make("gone@greenfield.test");
    await make("other@greenfield.test");
    await t.run(async (ctx) => await ctx.db.patch(expiredId, { expiresAt: Date.now() - 1000 }));
    await admin.as.mutation(api.invites.revoke, { inviteId: revokedId });

    expect(await refusal((await signInAs(t, { email: "old@greenfield.test" })).as.mutation(api.members.claimInvite, {}))).toBe("invite_expired");
    expect(await refusal((await signInAs(t, { email: "gone@greenfield.test" })).as.mutation(api.members.claimInvite, {}))).toBe("no_invite");
    expect(await refusal((await signInAs(t, { email: "different@greenfield.test" })).as.mutation(api.members.claimInvite, {}))).toBe("no_invite");
    expect((await counts(t)).members).toBe(2); // the owner and the institute admin only
  });

  test("covers AC-6: claiming twice, or from two tabs at once, makes one membership", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "asha@greenfield.test", name: "Asha", classId, under18: false });
    const s = await signInAs(t, { email: "asha@greenfield.test" });
    const results = await Promise.all([s.as.mutation(api.members.claimInvite, {}), s.as.mutation(api.members.claimInvite, {})]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results[0]).toEqual(results[1]);
    const rows = await t.run(async (ctx) => await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", s.userId)).collect());
    expect(rows).toHaveLength(1);
    expect((await s.as.mutation(api.members.claimInvite, {})).ok).toBe(true);
  });

  test("covers AC-16: an invite to a suspended institute or an archived class cannot be claimed", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin, instituteId } = await makeInstitute(t, owner);
    const classId = await makeClass(admin);
    await admin.as.mutation(api.invites.create, { role: "student", email: "asha@greenfield.test", name: "Asha", classId, under18: false });
    await admin.as.mutation(api.invites.create, { role: "teacher", email: "mr@greenfield.test", name: "Mr", });
    await t.run(async (ctx) => await ctx.db.patch(classId, { archivedAt: Date.now() }));
    expect(await refusal((await signInAs(t, { email: "asha@greenfield.test" })).as.mutation(api.members.claimInvite, {}))).toBe("class_archived");
    await owner.as.mutation(api.institutes.update, { instituteId, status: "suspended" });
    expect(await refusal((await signInAs(t, { email: "mr@greenfield.test" })).as.mutation(api.members.claimInvite, {}))).toBe("institute_suspended");
  });

  test("covers AC-17: the first Join attempt over 10 an hour is refused with rate_limited, and refused tries count", async () => {
    const t = makeBackend();
    const s = await signInAs(t, { email: "nobody@example.com" });
    for (let i = 0; i < 10; i++) expect(await refusal(s.as.mutation(api.members.claimInvite, {}))).toBe("no_invite");
    expect(await refusal(s.as.mutation(api.members.claimInvite, {}))).toBe("rate_limited");
  });
});

describe("the access log (AC-12)", () => {
  test("covers AC-12: every change to access leaves one row with a fixed code and ids, and no name, email or note", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t, "owner-secret@example.com");
    const { admin, instituteId } = await makeInstitute(t, owner, "Secret Name School", "head-secret@greenfield.test");
    const classId = await makeClass(admin);
    const student = await makeStudent(t, admin, classId, "kid-secret@greenfield.test");
    await admin.as.mutation(api.members.remove, { memberId: student.memberId });
    await admin.as.mutation(api.members.reinstate, { memberId: student.memberId });
    await owner.as.mutation(api.members.setUnder18, { memberId: student.memberId, under18: true });
    await owner.as.mutation(api.institutes.update, { instituteId, status: "suspended" });
    await owner.as.mutation(api.institutes.update, { instituteId, status: "active" });

    const log = await t.run(async (ctx) => await ctx.db.query("accessLog").collect());
    const actions = new Set(log.map((r) => r.action));
    for (const a of ["invite.create", "invite.claim", "class.create", "inst.create", "member.remove", "member.reinstate", "member.under18", "inst.suspend", "inst.reinstate"]) {
      expect(actions.has(a as never)).toBe(true);
    }
    const allowed = new Set(["_id", "_creationTime", "at", "actor", "action", "instituteId", "targetMemberId", "inviteId"]);
    for (const row of log) {
      for (const key of Object.keys(row)) expect(allowed.has(key)).toBe(true);
      const text = JSON.stringify(row).toLowerCase();
      for (const secret of ["secret", "@", "asha", "head teacher"]) expect(text.includes(secret)).toBe(false);
    }
  });
});

describe("the demo institute (AC-13)", () => {
  test("covers AC-13: the seed refuses unless the test sign in is on", async () => {
    const t = makeBackend();
    expect(await refusal(t.mutation(internal.demo.seed, {}))).toBe("demo_disabled");
    process.env.TEST_SIGNIN_ENABLED = "false";
    expect(await refusal(t.mutation(internal.demo.seed, {}))).toBe("demo_disabled");
    expect(await t.run(async (ctx) => (await ctx.db.query("institutes").collect()).length)).toBe(0);
  });

  test("covers AC-13: where it is on, the seed makes invites that a test sign in claims, and running it again adds nothing", async () => {
    const t = makeBackend();
    process.env.TEST_SIGNIN_ENABLED = "true";
    const first = await t.mutation(internal.demo.seed, {});
    expect(first.invitesMade).toBe(6); // admin, teacher, student, minor, newcomer and the consent gate person (house spec 0005)
    expect((await t.mutation(internal.demo.seed, {})).invitesMade).toBe(0);
    const student = await joinAs(t, "demo-student@example.test", { emailVerified: false });
    expect(await student.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "student", instituteName: "Demo Institute", className: "Class 10 A" });
    const admin = await joinAs(t, "demo-admin@example.test", { emailVerified: false });
    expect(await admin.as.query(api.members.me, {})).toMatchObject({ role: "institute_admin" });
  });
});
