// The demo institute (spec house/0002, AC-13). It exists only where the test sign in is on (development and preview): it makes invites for
// fixed `@example.test` addresses, which a test sign in can claim, so the house can be shown and tested with no real person. Production has
// no demo seat, and the seed refuses to run there. Run: `npx convex run demo:seed` on the development deployment.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { fail } from "./helpers";
import { ensureConsentText } from "./consentState";
import { HOUSE_ACCEPTED_VERSIONS, HOUSE_NOTICE_VERSION, HOUSE_PARENT_VERSION } from "./consentText";
import { emailTaken, insertInvite } from "./inviteCore";

export const DEMO_INSTITUTE = "Demo Institute";
export const DEMO_PEOPLE = {
  institute_admin: { email: "demo-admin@example.test", name: "Demo Admin" },
  teacher: { email: "demo-teacher@example.test", name: "Demo Teacher" },
  student: { email: "demo-student@example.test", name: "Demo Student" },
  minor: { email: "demo-minor@example.test", name: "Demo Minor" },
  // Its invite is never claimed by the browser scripts, so the Join page can be looked at again and again.
  newcomer: { email: "demo-newcomer@example.test", name: "Demo Newcomer" },
  // Joins and is left at the consent gate on purpose (spec house/0005), so the consent screen can be looked at again and again.
  gate: { email: "demo-gate@example.test", name: "Demo Gate" },
} as const;

const DEMO_EMAILS: readonly string[] = Object.values(DEMO_PEOPLE)
  .map((p) => p.email)
  .filter((email) => email !== DEMO_PEOPLE.gate.email);

// The demo students arrive with their consent recorded (spec house/0005, AC-22), so the browser scripts that sign in as them keep working. This
// runs only where the test sign in is on and only for the fixed demo addresses, and only a student gets records: the demo minor also gets the
// school's parent record, made in the name of the demo institute admin if that person has joined, else in their own name. It is idempotent.
export async function recordDemoConsent(ctx: MutationCtx, member: Doc<"members">): Promise<void> {
  if (env.TEST_SIGNIN_ENABLED !== "true" || member.role !== "student" || !DEMO_EMAILS.includes(member.email)) return;
  await ensureConsentText(ctx, HOUSE_NOTICE_VERSION, "house");
  const has = async (kind: "self" | "parent") =>
    (await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", member._id).eq("kind", kind)).first()) !== null;
  // A student who agreed to an older draft of the notice agrees again to the current one.
  const agreed = await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", member._id).eq("kind", "self")).take(10);
  if (!agreed.some((r) => HOUSE_ACCEPTED_VERSIONS.includes(r.textVersion))) {
    await ctx.db.insert("consentRecords", { memberId: member._id, instituteId: member.instituteId, kind: "self", by: "self", byMemberId: member._id, textVersion: HOUSE_NOTICE_VERSION, under18AtTime: member.under18 !== false });
  }
  if (member.under18 !== false && !(await has("parent"))) {
    await ensureConsentText(ctx, HOUSE_PARENT_VERSION, "house_parent");
    const admin = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", DEMO_PEOPLE.institute_admin.email)).first();
    await ctx.db.insert("consentRecords", { memberId: member._id, instituteId: member.instituteId, kind: "parent", by: "school", byMemberId: admin?._id ?? member._id, textVersion: HOUSE_PARENT_VERSION, under18AtTime: true });
  }
}

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
    if (await inviteOnce(ctx, DEMO_PEOPLE.gate, { role: "student", instituteId, classId, under18: false })) made += 1;
    // A demo student who joined before this ran gets their consent now.
    for (const p of [DEMO_PEOPLE.student, DEMO_PEOPLE.minor, DEMO_PEOPLE.newcomer]) {
      const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", p.email)).first();
      if (member) await recordDemoConsent(ctx, member);
    }
    return { instituteId, invitesMade: made };
  },
});
