// Development only helper for the production rehearsal (docs/launch/PROGRESS.md, Phase 4). On production the first DHI admin claims their
// `bootstrap:dhiAdmin` invite with their own Google account, then makes the first institute, a class and the invites in the staff area. A test inbox can
// never claim a DHI admin invite (houseCore.mayClaimUnverified), so on development this one step is done here: a fresh made up institute
// ("Rehearsal School <tag>"), one class, and invites for an institute admin, a teacher, a student under 18 and an adult student, all `@example.test`.
// Everything after it (joining, the notice, the parent's consent, the rooms, the pause, download and erase) runs through the real screens in
// `scripts/rehearsal-check.mjs`. Internal only, and it refuses to run where the test sign in is off (production):
//   npx convex run rehearsalProof:setup '{"tag":"abc12"}'
import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";
import { fail } from "./helpers";
import { emailTaken, insertInvite } from "./inviteCore";

export const setup = internalMutation({
  args: { tag: v.string() },
  returns: v.object({ institute: v.string(), people: v.array(v.object({ role: v.string(), email: v.string(), name: v.string() })) }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const tag = args.tag.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    if (!tag) fail("bad_tag");
    const name = `Rehearsal School ${tag}`;
    const nameKey = name.toLowerCase();
    if (await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first()) fail("tag_in_use");
    const instituteId = await ctx.db.insert("institutes", { name, nameKey, status: "active", plan: "rehearsal" });
    const classId = await ctx.db.insert("classes", { instituteId, grade: "Class 9", section: "B" });
    const letters = (s: string) => s.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]);
    const people = [
      { role: "institute_admin", email: `rehearsal-admin-${tag}@example.test`, name: `Rehearsal Admin ${letters(tag)}` },
      { role: "teacher", email: `rehearsal-teacher-${tag}@example.test`, name: `Rehearsal Teacher ${letters(tag)}` },
      { role: "student", email: `rehearsal-minor-${tag}@example.test`, name: `Rehearsal Minor ${letters(tag)}`, under18: true },
      { role: "student", email: `rehearsal-adult-${tag}@example.test`, name: `Rehearsal Adult ${letters(tag)}`, under18: false },
    ] as const;
    for (const p of people) {
      if (await emailTaken(ctx, p.email)) fail("email_in_use");
      const draft =
        p.role === "student"
          ? { role: "student" as const, instituteId, classId, under18: "under18" in p ? p.under18 : false }
          : { role: p.role, instituteId };
      await insertInvite(ctx, { draft, email: p.email, name: p.name, createdBy: "owner" });
    }
    return { institute: name, people: people.map((p) => ({ role: p.role, email: p.email, name: p.name })) };
  },
});

// The made up pilot class on development (house spec 0021, the checklist): "Pilot School <tag>", Class 10 P, an institute admin, a teacher and ten
// students, six of them under 18. Everything after it (joining, the notice, the parent's consent) runs through the real screens in
// `scripts/pilot-setup.mjs`. Internal, and refuses where the test sign in is off (production):
//   npx convex run rehearsalProof:pilotSetup '{"tag":"abc12"}'
export const PILOT_STUDENTS = 10;
export const PILOT_UNDER_18 = 6;
export const pilotSetup = internalMutation({
  args: { tag: v.string() },
  returns: v.object({ institute: v.string(), people: v.array(v.object({ role: v.string(), email: v.string(), name: v.string(), under18: v.boolean() })) }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const tag = args.tag.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    if (!tag) fail("bad_tag");
    const name = `Pilot School ${tag}`;
    const nameKey = name.toLowerCase();
    if (await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first()) fail("tag_in_use");
    const instituteId = await ctx.db.insert("institutes", { name, nameKey, status: "active", plan: "rehearsal" });
    const classId = await ctx.db.insert("classes", { instituteId, grade: "Class 10", section: "P" });
    const letters = (s: string) => s.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]);
    const people: { role: "institute_admin" | "teacher" | "student"; email: string; name: string; under18: boolean }[] = [
      { role: "institute_admin", email: `pilot-admin-${tag}@example.test`, name: `Pilot Admin ${letters(tag)}`, under18: false },
      { role: "teacher", email: `pilot-teacher-${tag}@example.test`, name: `Pilot Teacher ${letters(tag)}`, under18: false },
    ];
    for (let i = 1; i <= PILOT_STUDENTS; i += 1) {
      const minor = i <= PILOT_UNDER_18;
      people.push({ role: "student", email: `pilot-${minor ? "minor" : "adult"}${i}-${tag}@example.test`, name: `Pilot Student ${"abcdefghij"[i - 1]} ${letters(tag)}`, under18: minor });
    }
    for (const p of people) {
      if (await emailTaken(ctx, p.email)) fail("email_in_use");
      const draft = p.role === "student" ? { role: "student" as const, instituteId, classId, under18: p.under18 } : { role: p.role, instituteId };
      await insertInvite(ctx, { draft, email: p.email, name: p.name, createdBy: "owner" });
    }
    return { institute: name, people };
  },
});

// After the pilot teacher has joined: their class link, as the institute admin's Classes screen makes it.
export const pilotAssign = internalMutation({
  args: { tag: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const institute = await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", `pilot school ${args.tag}`)).first();
    if (!institute) fail("not_found");
    const teacher = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", `pilot-teacher-${args.tag}@example.test`)).first();
    const cls = await ctx.db.query("classes").withIndex("by_instituteId_and_grade", (q) => q.eq("instituteId", institute._id).eq("grade", "Class 10")).first();
    if (!teacher || !cls) fail("not_found");
    const existing = await ctx.db.query("teacherClasses").withIndex("by_memberId_and_classId", (q) => q.eq("memberId", teacher._id).eq("classId", cls._id)).first();
    if (!existing) await ctx.db.insert("teacherClasses", { memberId: teacher._id, classId: cls._id, instituteId: institute._id });
    return null;
  },
});
