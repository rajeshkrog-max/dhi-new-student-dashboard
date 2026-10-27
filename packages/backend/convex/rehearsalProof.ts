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
