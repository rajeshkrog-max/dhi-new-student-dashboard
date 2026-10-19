// The demo institute (spec house/0002, AC-13). It exists only where the test sign in is on (development and preview): it makes invites for
// fixed `@example.test` addresses, which a test sign in can claim, so the house can be shown and tested with no real person. Production has
// no demo seat, and the seed refuses to run there. Run: `npx convex run demo:seed` on the development deployment.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { fail } from "./helpers";
import { emailTaken, insertInvite } from "./inviteCore";

export const DEMO_INSTITUTE = "Demo Institute";
export const DEMO_PEOPLE = {
  institute_admin: { email: "demo-admin@example.test", name: "Demo Admin" },
  teacher: { email: "demo-teacher@example.test", name: "Demo Teacher" },
  student: { email: "demo-student@example.test", name: "Demo Student" },
  minor: { email: "demo-minor@example.test", name: "Demo Minor" },
  // Its invite is never claimed by the browser scripts, so the Join page can be looked at again and again.
  newcomer: { email: "demo-newcomer@example.test", name: "Demo Newcomer" },
} as const;

async function inviteOnce(
  ctx: MutationCtx,
  who: { email: string; name: string },
  draft: { role: "student" | "teacher" | "institute_admin"; instituteId: Id<"institutes">; classId?: Id<"classes">; under18?: boolean },
): Promise<boolean> {
  if (await emailTaken(ctx, who.email)) return false;
  await insertInvite(ctx, { draft, email: who.email, name: who.name, createdBy: "owner" });
  return true;
}

export const seed = internalMutation({
  args: {},
  returns: v.object({ instituteId: v.id("institutes"), invitesMade: v.number() }),
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("demo_disabled");

    const nameKey = DEMO_INSTITUTE.toLowerCase();
    const existing = await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first();
    const instituteId = existing?._id ?? (await ctx.db.insert("institutes", { name: DEMO_INSTITUTE, nameKey, status: "active", plan: "demo" }));
    const classRow = await ctx.db
      .query("classes")
      .withIndex("by_instituteId_and_grade", (q) => q.eq("instituteId", instituteId).eq("grade", "Class 10"))
      .first();
    const classId = classRow?._id ?? (await ctx.db.insert("classes", { instituteId, grade: "Class 10", section: "A" }));

    let made = 0;
    if (await inviteOnce(ctx, DEMO_PEOPLE.institute_admin, { role: "institute_admin", instituteId })) made += 1;
    if (await inviteOnce(ctx, DEMO_PEOPLE.teacher, { role: "teacher", instituteId })) made += 1;
    if (await inviteOnce(ctx, DEMO_PEOPLE.student, { role: "student", instituteId, classId, under18: false })) made += 1;
    if (await inviteOnce(ctx, DEMO_PEOPLE.minor, { role: "student", instituteId, classId, under18: true })) made += 1;
    if (await inviteOnce(ctx, DEMO_PEOPLE.newcomer, { role: "student", instituteId, classId, under18: false })) made += 1;
    return { instituteId, invitesMade: made };
  },
});
