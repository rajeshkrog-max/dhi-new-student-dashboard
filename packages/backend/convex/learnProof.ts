// A development only helper for the browser proof of the desk's Learn panel and the new inputs (house specs 0030 and 0031). It refuses to run where the
// test sign in is off (production). Every person and question is made up.
//   npx convex run learnProof:bankFor '{"email":"someone@example.test"}'     a practice bank paper of a teacher of the student's class, on "Ratios"
//   (the made up habit for the feels check is habitProof:habitFor)
//   npx convex run learnProof:keepFilm '{"email":"someone@example.test"}'    marks an approved academic film as watched to its end for the student
import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";
import { fail } from "./helpers";
import { ensureTopic, noteSent } from "./topics";

const QUESTIONS = [
  { text: "What is the ratio 2 to 4 in its simplest form?", options: ["1 to 2", "2 to 1", "1 to 4"], right: 0 },
  { text: "If 3 pens cost 15 rupees, what do 5 pens cost?", options: ["20 rupees", "25 rupees", "30 rupees"], right: 1 },
  { text: "Which ratio is the same as 6 to 9?", options: ["3 to 2", "2 to 4", "2 to 3"], right: 2 },
];

export const bankFor = internalMutation({
  args: { email: v.string() },
  returns: v.object({ topicId: v.id("paperTopics"), questions: v.array(v.object({ text: v.string(), right: v.string() })) }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member || member.role !== "student" || !member.instituteId || !member.classId) fail("not_found");
    const link = await ctx.db.query("teacherClasses").withIndex("by_classId", (q) => q.eq("classId", member.classId!)).first();
    if (!link) fail("no_teacher");
    const topicId = await ensureTopic(ctx, member.instituteId, "maths", "Ratios");
    await ctx.db.patch(topicId, { chapter: "Chapter 4", inMap: true });
    const paperId = await ctx.db.insert("papers", { teacherMemberId: link.memberId, instituteId: member.instituteId, title: "Ratios practice (made up)", status: "bank", createdAt: Date.now() });
    for (const [order, q] of QUESTIONS.entries()) {
      await ctx.db.insert("paperQuestions", {
        paperId,
        order,
        kind: "mcq",
        subject: "maths",
        topic: "Ratios",
        topicId,
        text: q.text,
        options: q.options,
        rightOption: q.right,
        tags: q.options.map((_, i) => (i === q.right ? null : "concept")),
      });
    }
    await ctx.db.insert("paperQuestions", {
      paperId,
      order: QUESTIONS.length,
      kind: "long",
      subject: "maths",
      topic: "Ratios",
      topicId,
      text: "Explain what a ratio tells you, with an example.",
      maxMarks: 4,
      rubric: "- compares two amounts\n- an example with numbers",
    });
    await noteSent(ctx, member.classId, [{ topicId, subject: "maths" }], Date.now());
    return { topicId, questions: QUESTIONS.map((q) => ({ text: q.text, right: q.options[q.right] })) };
  },
});

export const keepFilm = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.null(), v.object({ title: v.string() })),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member || member.role !== "student" || !member.instituteId) fail("not_found");
    const films = await ctx.db.query("films").withIndex("by_status", (q) => q.eq("status", "approved")).take(50);
    const film = films.find((f) => f.category === "academic");
    if (!film) return null;
    // The demo films were added without check questions; two made up ones are added once so the checks can be answered.
    if (!(await ctx.db.query("filmChecks").withIndex("by_filmId", (q) => q.eq("filmId", film._id)).first())) {
      await ctx.db.insert("filmChecks", { filmId: film._id, order: 0, question: "Which part of a plant makes its food?", options: ["The leaf", "The root", "The flower"], rightOption: 0 });
      await ctx.db.insert("filmChecks", { filmId: film._id, order: 1, question: "What does a plant take in from the air to make food?", options: ["Oxygen", "Carbon dioxide", "Nitrogen"], rightOption: 1 });
    }
    const now = Date.now();
    const row = await ctx.db.query("filmProgress").withIndex("by_memberId_and_filmId", (q) => q.eq("memberId", member._id).eq("filmId", film._id)).first();
    if (row) await ctx.db.patch(row._id, { furthestSec: film.durationSec, scored: true, scoredAt: now, lastAt: now });
    else await ctx.db.insert("filmProgress", { memberId: member._id, instituteId: member.instituteId, filmId: film._id, furthestSec: film.durationSec, scored: true, scoredAt: now, lastAt: now });
    return { title: film.title };
  },
});
