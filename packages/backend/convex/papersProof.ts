// Development only helpers for the browser proofs of the papers screens (spec house/0011 and house/0012). The demo teacher is invited by the demo
// seed but is given no class, so a teacher cannot send a paper. `assignDemoTeacher` gives the demo teacher the demo student's class, and does nothing
// else. `openDemoPaper` makes a paper called "Sweep paper" (one multiple choice and one long question, each with a hint) and sends it to the demo
// student with a window that is open now, replacing the last one, so the responsive sweep can look at the sitting. Both are internal only and refuse
// to run where the test sign in is off (production). Run after `demo:seed` and a sign in of both demo people:
//   npx convex run papersProof:assignDemoTeacher
//   npx convex run papersProof:openDemoPaper
// `resetDemoSitting` puts every open sitting of the demo student back to not started (a proof that stopped part way can leave one), so the server's
// exam lock (examLock.ts) does not hold the demo student in every later room of the sweep and of the other proofs.
//   npx convex run papersProof:resetDemoSitting
import { internalMutation, env } from "./_generated/server";
import { fail } from "./helpers";

export const assignDemoTeacher = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const teacher = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-teacher@example.test")).first();
    const student = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-student@example.test")).first();
    if (!teacher || !student?.classId || !teacher.instituteId) fail("run_demo_seed_and_sign_in_first");
    const existing = await ctx.db.query("teacherClasses").withIndex("by_memberId_and_classId", (q) => q.eq("memberId", teacher._id).eq("classId", student.classId!)).first();
    if (!existing) await ctx.db.insert("teacherClasses", { memberId: teacher._id, classId: student.classId, instituteId: teacher.instituteId });
    return { classId: student.classId, assigned: existing === null };
  },
});

export const openDemoPaper = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const teacher = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-teacher@example.test")).first();
    const student = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-student@example.test")).first();
    if (!teacher || !student?.instituteId || !teacher.instituteId) fail("run_demo_seed_and_sign_in_first");
    // The last sweep paper, its questions and the demo student's attempt at it go first.
    for (const old of await ctx.db.query("papers").withIndex("by_teacherMemberId", (q) => q.eq("teacherMemberId", teacher._id)).take(200)) {
      if (old.title !== "Sweep paper") continue;
      for (const row of await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", old._id)).take(60)) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", old._id)).take(600)) await ctx.db.delete(row._id);
      await ctx.db.delete(old._id);
    }
    const now = Date.now();
    const paperId = await ctx.db.insert("papers", { teacherMemberId: teacher._id, instituteId: teacher.instituteId, title: "Sweep paper", status: "sent", createdAt: now });
    await ctx.db.insert("paperQuestions", {
      paperId,
      order: 0,
      kind: "mcq",
      subject: "maths",
      topic: "Fractions",
      text: "What is half of four?",
      options: ["One", "Two", "Three"],
      rightOption: 1,
      tags: ["misread", null, "concept"],
      hint: "Share four things equally between two friends.",
    });
    await ctx.db.insert("paperQuestions", { paperId, order: 1, kind: "long", subject: "english", topic: "Story", text: "Tell a short story about a lamp.", maxMarks: 10, rubric: "Plot, voice, ending", hint: "Say who, then what happened." });
    await ctx.db.insert("paperAttempts", { paperId, memberId: student._id, instituteId: student.instituteId, status: "assigned", opensAt: now - 60 * 60 * 1000, dueAt: now + 24 * 60 * 60 * 1000 });
    return { paperId };
  },
});

export const resetDemoSitting = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const student = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-student@example.test")).first();
    if (!student) return { reset: 0 };
    let reset = 0;
    for (const row of await ctx.db.query("paperAttempts").withIndex("by_memberId_and_status", (q) => q.eq("memberId", student._id).eq("status", "open")).take(20)) {
      await ctx.db.patch(row._id, { status: "assigned", startedAt: undefined, answers: undefined, hintsOpened: undefined });
      reset += 1;
    }
    return { reset };
  },
});
