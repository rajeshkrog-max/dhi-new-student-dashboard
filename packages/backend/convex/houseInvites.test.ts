// Invites and class lists (spec house/0002). Each test names the criterion it covers.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { makeBackend, signInAs } from "../tests/convexTestUtils";
import { giveConsent, joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const page = { numItems: 25, cursor: null };

async function school() {
  const t = makeBackend();
  const owner = await makeDhiAdmin(t);
  const { admin, instituteId } = await makeInstitute(t, owner, "Alpha School", "head@alpha.test");
  const a = await makeClass(admin, "Class 10", "A");
  const b = await makeClass(admin, "Class 9", "B");
  return { t, owner, admin, instituteId, a, b };
}

const row = (n: number, over: Record<string, unknown> = {}) => ({ name: `Student ${n}`, email: `s${n}@alpha.test`, class: "10A", under18: false, ...over });

describe("a class list is checked as a whole (AC-4)", () => {
  test("covers AC-4: when every row is valid, every invite is created", async () => {
    const { t, admin } = await school();
    const r = await admin.as.mutation(api.invites.createBatch, { rows: [row(1), row(2, { class: "Class 9 B", under18: true }), row(3)] });
    expect(r).toEqual({ ok: true, count: 3 });
    const invites = await t.run(async (ctx) => await ctx.db.query("invites").collect());
    expect(invites.filter((i) => i.role === "student")).toHaveLength(3);
    expect(invites.find((i) => i.email === "s2@alpha.test")?.under18).toBe(true);
  });

  test("covers AC-4: if any row is bad, none are created and each bad row has one fixed reason", async () => {
    const { t, admin } = await school();
    await makeStudent(t, admin, (await makeClass(admin, "Class 11", "A")), "taken@alpha.test");
    const before = await t.run(async (ctx) => (await ctx.db.query("invites").collect()).length);
    const r = await admin.as.mutation(api.invites.createBatch, {
      rows: [
        row(1), //                                    1 fine
        row(2, { name: "   " }), //                    2 bad_name
        row(3, { email: "not an email" }), //          3 bad_email
        row(4, { email: "S1@alpha.test" }), //         4 duplicate_in_file
        row(5, { email: "taken@alpha.test" }), //      5 email_in_use
        row(6, { class: "Class 8 Z" }), //             6 class_not_found
        row(7, { class: "gibberish" }), //             7 class_not_found
        row(8, { under18: null }), //                  8 under18_missing
      ],
    });
    expect(r).toEqual({
      ok: false,
      code: "bad_rows",
      badRows: [
        { row: 2, reason: "bad_name" },
        { row: 3, reason: "bad_email" },
        { row: 4, reason: "duplicate_in_file" },
        { row: 5, reason: "email_in_use" },
        { row: 6, reason: "class_not_found" },
        { row: 7, reason: "class_not_found" },
        { row: 8, reason: "under18_missing" },
      ],
    });
    expect(await t.run(async (ctx) => (await ctx.db.query("invites").collect()).length)).toBe(before);
  });

  test("covers AC-4: more than 300 rows, an empty list and a list for another institute are refused", async () => {
    const { owner, admin, t } = await school();
    const big = Array.from({ length: 301 }, (_, i) => row(i));
    expect(await refusal(admin.as.mutation(api.invites.createBatch, { rows: big }))).toBe("too_many_rows");
    expect(await refusal(admin.as.mutation(api.invites.createBatch, { rows: [] }))).toBe("empty");
    const other = await makeInstitute(t, owner, "Beta School", "head@beta.test");
    expect(await refusal(admin.as.mutation(api.invites.createBatch, { rows: [row(1)], instituteId: other.instituteId }))).toBe("forbidden");
    expect(await refusal(owner.as.mutation(api.invites.createBatch, { rows: [row(1)] }))).toBe("institute_not_found");
  });

  test("covers AC-4, AC-7: a teacher's list may name only their own classes, and a class outside them is a bad row", async () => {
    const { t, admin, a, b } = await school();
    const teacher = await makeTeacher(t, admin, "teacher@alpha.test", [a]);
    const r = await teacher.as.mutation(api.invites.createBatch, { rows: [row(1), row(2, { class: "Class 9 B" })] });
    expect(r).toEqual({ ok: false, code: "bad_rows", badRows: [{ row: 2, reason: "class_not_in_scope" }] });
    expect(await teacher.as.mutation(api.invites.createBatch, { rows: [row(1)] })).toEqual({ ok: true, count: 1 });
    void b;
  });

  test("covers AC-4: an archived class is not offered to a class list", async () => {
    const { t, admin, a } = await school();
    await t.run(async (ctx) => await ctx.db.patch(a, { archivedAt: Date.now() }));
    const r = await admin.as.mutation(api.invites.createBatch, { rows: [row(1)] });
    expect(r).toMatchObject({ ok: false, badRows: [{ row: 1, reason: "class_not_found" }] });
  });

  test("covers AC-17: the first class list over 10 an hour is refused with rate_limited, and a list with bad rows still counts", async () => {
    const { admin } = await school();
    for (let i = 0; i < 10; i++) expect(await refusal(admin.as.mutation(api.invites.createBatch, { rows: [row(i, { name: "" })] }))).toBe("bad_rows");
    expect(await refusal(admin.as.mutation(api.invites.createBatch, { rows: [row(99)] }))).toBe("rate_limited");
  });
});

describe("single invites", () => {
  test("covers AC-11: the under 18 flag comes from the invite, and a student invite needs it", async () => {
    const { t, admin, a } = await school();
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "student", email: "k@alpha.test", name: "K", classId: a }))).toBe("under18_missing");
    const kid = await makeStudent(t, admin, a, "k@alpha.test", true);
    const member = await t.run(async (ctx) => await ctx.db.get(kid.memberId));
    expect(member?.under18).toBe(true);
    expect(await kid.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "student" });
  });

  test("a student invite needs a class of the institute; a class of another institute is class_not_found", async () => {
    const { t, owner, admin } = await school();
    const beta = await makeInstitute(t, owner, "Beta School", "head@beta.test");
    const foreign = await makeClass(beta.admin, "Class 10", "A");
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "student", email: "k@alpha.test", name: "K", classId: foreign, under18: false }))).toBe("class_not_found");
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "student", email: "k@alpha.test", name: "K", under18: false }))).toBe("class_not_found");
  });

  test("a bad name and a bad address are refused with their own reasons", async () => {
    const { admin } = await school();
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "teacher", email: "t@alpha.test", name: "   " }))).toBe("bad_name");
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "teacher", email: "nope", name: "T" }))).toBe("bad_email");
  });

  test("covers AC-8: a teacher cannot invite a teacher or an admin, and an institute admin cannot invite staff of DHI", async () => {
    const { t, admin, a } = await school();
    const teacher = await makeTeacher(t, admin, "teacher@alpha.test", [a]);
    for (const role of ["teacher", "institute_admin", "dhi_admin", "counselor"] as const) {
      expect(await refusal(teacher.as.mutation(api.invites.create, { role, email: `${role}@alpha.test`, name: "X" }))).toBe("forbidden");
    }
    for (const role of ["institute_admin", "dhi_admin", "counselor"] as const) {
      expect(await refusal(admin.as.mutation(api.invites.create, { role, email: `${role}@alpha.test`, name: "X" }))).toBe("forbidden");
    }
  });

  test("an address that is a member, a removed member or already invited is email_in_use, the same neutral answer for each", async () => {
    const { t, admin, a } = await school();
    const kid = await makeStudent(t, admin, a, "kid@alpha.test");
    await admin.as.mutation(api.invites.create, { role: "teacher", email: "pending@alpha.test", name: "P" });
    await admin.as.mutation(api.members.remove, { memberId: kid.memberId });
    const again = (email: string) => admin.as.mutation(api.invites.create, { role: "teacher", email, name: "X" });
    expect(await again("kid@alpha.test")).toEqual({ ok: false, code: "email_in_use" }); // a removed member
    expect(await again("pending@alpha.test")).toEqual({ ok: false, code: "email_in_use" }); // a pending invite
    expect(await again("head@alpha.test")).toEqual({ ok: false, code: "email_in_use" }); // an active member
    expect(await again("KID@alpha.test")).toEqual({ ok: false, code: "email_in_use" }); // case does not matter
  });

  test("an expired invite still blocks a new one until it is revoked or extended", async () => {
    const { t, admin } = await school();
    const made = await admin.as.mutation(api.invites.create, { role: "teacher", email: "late@alpha.test", name: "L" });
    if (!made.ok) throw new Error("setup");
    await t.run(async (ctx) => await ctx.db.patch(made.inviteId, { expiresAt: Date.now() - 1 }));
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "teacher", email: "late@alpha.test", name: "L" }))).toBe("email_in_use");
    const extended = await admin.as.mutation(api.invites.extend, { inviteId: made.inviteId });
    expect(extended.expiresAt).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
    expect(await refusal((await signInAs(t, { email: "late@alpha.test" })).as.mutation(api.members.claimInvite, {}))).toBe("ok");
  });

  test("update fixes an address, revoke clears an invite, and neither works on a claimed or revoked invite", async () => {
    const { t, owner, admin } = await school();
    const made = await admin.as.mutation(api.invites.create, { role: "teacher", email: "typo@alpha.test", name: "T" });
    if (!made.ok) throw new Error("setup");
    expect(await admin.as.mutation(api.invites.update, { inviteId: made.inviteId, email: "right@alpha.test" })).toEqual({ ok: true });
    expect(await refusal(admin.as.mutation(api.invites.update, { inviteId: made.inviteId, email: "head@alpha.test" }))).toBe("email_in_use");
    expect(await refusal(admin.as.mutation(api.invites.update, { inviteId: made.inviteId, email: "nope" }))).toBe("bad_email");
    // The old address no longer has an invite; the new one does.
    expect((await (await signInAs(t, { email: "typo@alpha.test" })).as.query(api.members.me, {})).state).toBe("noHouse");
    expect((await (await signInAs(t, { email: "right@alpha.test" })).as.query(api.members.me, {})).state).toBe("invitePending");
    // A DHI admin can revoke an invite an institute admin made (AC-8).
    await owner.as.mutation(api.invites.revoke, { inviteId: made.inviteId });
    expect(await refusal(admin.as.mutation(api.invites.revoke, { inviteId: made.inviteId }))).toBe("invite_not_pending");
    expect(await refusal(admin.as.mutation(api.invites.extend, { inviteId: made.inviteId }))).toBe("invite_not_pending");
    expect(await refusal(admin.as.mutation(api.invites.update, { inviteId: made.inviteId, email: "again@alpha.test" }))).toBe("invite_not_pending");
    // A revoked invite frees the address for a new one.
    expect(await refusal(admin.as.mutation(api.invites.create, { role: "teacher", email: "right@alpha.test", name: "T" }))).toBe("ok");
  });

  test("covers AC-19: the 51st email_in_use refusal in a day for one institute is rate_limited, and the words never say why an address is in use", async () => {
    const { admin } = await school();
    for (let i = 0; i < 50; i++) {
      expect(await admin.as.mutation(api.invites.create, { role: "teacher", email: "head@alpha.test", name: "X" })).toEqual({ ok: false, code: "email_in_use" });
    }
    // The cap is spent: any further invite call from this institute is refused, even for a fresh address.
    expect(await admin.as.mutation(api.invites.create, { role: "teacher", email: "head@alpha.test", name: "X" })).toEqual({ ok: false, code: "rate_limited" });
    expect(await admin.as.mutation(api.invites.create, { role: "teacher", email: "fresh@alpha.test", name: "X" })).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-19: another institute is not slowed by the first one's refusals", async () => {
    const { t, owner, admin } = await school();
    const beta = await makeInstitute(t, owner, "Beta School", "head@beta.test");
    for (let i = 0; i < 50; i++) await admin.as.mutation(api.invites.create, { role: "teacher", email: "head@alpha.test", name: "X" });
    expect(await refusal(beta.admin.as.mutation(api.invites.create, { role: "teacher", email: "new@beta.test", name: "X" }))).toBe("ok");
  });
});

describe("lists are paginated at 25 (AC-18)", () => {
  test("covers AC-18: invites and members come 25 a page, even when more are asked for", async () => {
    const { t, admin, a } = await school();
    const rows = Array.from({ length: 40 }, (_, i) => row(i));
    expect(await admin.as.mutation(api.invites.createBatch, { rows })).toEqual({ ok: true, count: 40 });
    const first = await admin.as.query(api.invites.list, { paginationOpts: { numItems: 100, cursor: null } });
    expect(first.page.length).toBeLessThanOrEqual(25);
    expect(first.isDone).toBe(false);
    const second = await admin.as.query(api.invites.list, { paginationOpts: { numItems: 100, cursor: first.continueCursor } });
    expect(first.page.length + second.page.length).toBeGreaterThanOrEqual(26);
    const members = await admin.as.query(api.members.list, { paginationOpts: { numItems: 100, cursor: null } });
    expect(members.page.length).toBeLessThanOrEqual(25);
    void t;
    void a;
  });

  test("an invite list can be narrowed to pending, and says each invite's class and status", async () => {
    const { admin, a } = await school();
    const made = await admin.as.mutation(api.invites.create, { role: "student", email: "k@alpha.test", name: "K", classId: a, under18: true });
    if (!made.ok) throw new Error("setup");
    const pending = await admin.as.query(api.invites.list, { paginationOpts: page, status: "pending" });
    expect(pending.page.find((i) => i.email === "k@alpha.test")).toMatchObject({ status: "pending", className: "Class 10 A", under18: true, role: "student" });
    await admin.as.mutation(api.invites.revoke, { inviteId: made.inviteId });
    const revoked = await admin.as.query(api.invites.list, { paginationOpts: page, status: "revoked" });
    expect(revoked.page.map((i) => i.email)).toEqual(["k@alpha.test"]);
    const claimed = await admin.as.query(api.invites.list, { paginationOpts: page, status: "claimed" });
    expect(claimed.page.map((i) => i.email)).toEqual(["head@alpha.test"]);
  });
});

describe("a person joins and lands in their class", () => {
  test("covers AC-2, AC-4, AC-5: the full happy path from a class list to a student in their class", async () => {
    const { t, admin } = await school();
    await admin.as.mutation(api.invites.createBatch, { rows: [row(1, { name: "Meera Iyer", email: "meera@alpha.test" })] });
    const meera = await joinAs(t, "meera@alpha.test", { name: "Meera Iyer" });
    await giveConsent(meera, null);
    expect(await meera.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "student", name: "Meera Iyer", className: "Class 10 A", instituteName: "Alpha School" });
  });
});
