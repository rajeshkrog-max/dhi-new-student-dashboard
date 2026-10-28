// The papers room, teacher side and the student's list (spec house/0011). A teacher builds a paper, sends it to a class or one student with an
// open and a due time, and marks long answers by hand. Each student sent a paper gets one attempt row, made at send time. The right answers and
// the wrong option tags never leave the server: no student function returns a question's text before the paper is open, and this version never
// returns question text to a student at all (the sitting comes in spec 0012). Every function starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { fail } from "./helpers";
import { requireMember, teacherClassIds } from "./houseAuth";
import { rateLimiter } from "./limits";
import { staffRead } from "./staffRead";
import { markProblem, paperProblem, totalOf, windowProblem, type QuestionInput } from "./papersRules";
import { subjectCodeOf } from "./sessionRules";
import { ensureTopic, noteSent } from "./topics";

const questionArg = v.union(
  v.object({
    kind: v.literal("mcq"),
    subject: v.string(),
    topic: v.string(),
    text: v.string(),
    options: v.array(v.string()),
    rightOption: v.number(),
    tags: v.array(v.union(v.string(), v.null())),
    hint: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("long"),
    subject: v.string(),
    topic: v.string(),
    text: v.string(),
    maxMarks: v.number(),
    rubric: v.string(),
    hint: v.optional(v.string()),
  }),
);

// Builds a paper for the teacher who signs in. Only a teacher can build one.
export const create = mutation({
  args: { title: v.string(), questions: v.array(questionArg) },
  returns: v.id("papers"),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const problem = paperProblem(args.title, args.questions);
    if (problem) fail(problem);
    // The subject is one of the fixed list (house spec 0028), so a desk or study hour card can name the same one.
    if (args.questions.some((q) => subjectCodeOf(q.subject) === null)) fail("bad_question");
    const instituteId = mc.member.instituteId as NonNullable<typeof mc.member.instituteId>;
    const paperId = await ctx.db.insert("papers", {
      teacherMemberId: mc.member._id,
      instituteId,
      title: args.title.trim(),
      status: "draft",
      createdAt: Date.now(),
    });
    for (const [order, q] of (args.questions as QuestionInput[]).entries()) {
      const hint = q.hint?.trim();
      const subject = subjectCodeOf(q.subject)!;
      const topicId = await ensureTopic(ctx, instituteId, subject, q.topic);
      if (q.kind === "mcq") {
        await ctx.db.insert("paperQuestions", {
          paperId,
          order,
          kind: "mcq",
          subject,
          topic: q.topic.trim(),
          topicId,
          text: q.text.trim(),
          options: q.options.map((o) => o.trim()),
          rightOption: q.rightOption,
          tags: q.tags,
          ...(hint ? { hint } : {}),
        });
      } else {
        await ctx.db.insert("paperQuestions", {
          paperId,
          order,
          kind: "long",
          subject,
          topic: q.topic.trim(),
          topicId,
          text: q.text.trim(),
          maxMarks: q.maxMarks,
          rubric: q.rubric.trim(),
          ...(hint ? { hint } : {}),
        });
      }
    }
    return paperId;
  },
});

// Whether a teacher may act on a paper: the teacher who built it, in the same institute.
async function ownPaper(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, instituteId: Id<"institutes"> | undefined, paperId: Id<"papers">) {
  const paper = await ctx.db.get(paperId);
  if (!paper) fail("not_found");
  if (paper.teacherMemberId !== memberId || paper.instituteId !== instituteId) fail("forbidden");
  return paper;
}

// Sends a paper to a class or one student, with an open and a due time. The class is expanded now: one attempt row per active student of it.
// A student already sent the paper keeps their row, so sending again changes nothing for them.
export const send = mutation({
  args: {
    paperId: v.id("papers"),
    target: v.union(v.object({ kind: v.literal("class"), classId: v.id("classes") }), v.object({ kind: v.literal("student"), memberId: v.id("members") })),
    opensAt: v.number(),
    dueAt: v.number(),
  },
  returns: v.object({ ok: v.literal(true), made: v.number() }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const window = windowProblem(args.opensAt, args.dueAt, Date.now());
    if (window) fail(window);
    const paper = await ownPaper(ctx, mc.member._id, mc.member.instituteId, args.paperId);
    const mine = await teacherClassIds(ctx, mc.member._id);

    const students: Doc<"members">[] = [];
    if (args.target.kind === "class") {
      if (!mine.includes(args.target.classId)) fail("forbidden");
      if ((await ctx.db.get(args.target.classId))?.pausedAt !== undefined) fail("class_paused");
      const roster = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", args.target.kind === "class" ? args.target.classId : undefined)).take(500);
      students.push(...roster.filter((m) => m.role === "student" && m.status === "active" && m.instituteId === paper.instituteId));
    } else {
      const student = await ctx.db.get(args.target.memberId);
      if (!student || student.role !== "student" || student.instituteId !== paper.instituteId) fail("not_found");
      if (!student.classId || !mine.includes(student.classId)) fail("forbidden");
      if ((await ctx.db.get(student.classId))?.pausedAt !== undefined) fail("class_paused");
      students.push(student);
    }

    let made = 0;
    for (const student of students) {
      const existing = await ctx.db
        .query("paperAttempts")
        .withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", args.paperId).eq("memberId", student._id))
        .first();
      if (existing) continue;
      await ctx.db.insert("paperAttempts", {
        paperId: args.paperId,
        memberId: student._id,
        instituteId: paper.instituteId,
        status: "assigned",
        opensAt: args.opensAt,
        dueAt: args.dueAt,
      });
      made += 1;
    }
    await ctx.db.insert("paperSends", {
      paperId: args.paperId,
      instituteId: paper.instituteId,
      target: args.target.kind,
      ...(args.target.kind === "class" ? { classId: args.target.classId } : { memberId: args.target.memberId }),
      opensAt: args.opensAt,
      dueAt: args.dueAt,
      sentAt: Date.now(),
    });
    // The paper's topics, noted for the class it went to (or the one student's class), so the class's cards can offer them (house spec 0028).
    const sentTo = args.target.kind === "class" ? args.target.classId : students[0]?.classId;
    if (sentTo !== undefined) {
      const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", args.paperId)).take(50);
      await noteSent(ctx, sentTo, questions.flatMap((q) => (q.topicId ? [{ topicId: q.topicId, subject: q.subject }] : [])), Date.now());
    }
    await ctx.db.patch(args.paperId, { status: "sent" });
    return { ok: true as const, made };
  },
});

// The student's own papers: the title and the window, and the mark once the teacher has confirmed it. No question text in this version.
export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      attemptId: v.id("paperAttempts"),
      title: v.string(),
      opensAt: v.number(),
      dueAt: v.number(),
      status: v.string(),
      mark: v.union(v.object({ total: v.number(), maxTotal: v.number(), remarks: v.string() }), v.null()),
      accepted: v.boolean(),
      excused: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    // The newest 200 papers, so a student who has been sent many still sees the latest ones.
    const rows = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(200);
    const out = [];
    const maxOf = new Map<string, number>();
    for (const row of rows) {
      const paper = await ctx.db.get(row.paperId);
      if (!paper) continue;
      let mark: { total: number; maxTotal: number; remarks: string } | null = null;
      if (row.status === "confirmed") {
        let maxTotal = maxOf.get(row.paperId);
        if (maxTotal === undefined) {
          const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", row.paperId)).take(50);
          maxTotal = questions.reduce((sum, q) => sum + (q.kind === "long" ? (q.maxMarks ?? 0) : 1), 0);
          maxOf.set(row.paperId, maxTotal);
        }
        mark = { total: (row.mcqCorrect ?? 0) + totalOf(row.marks ?? []), maxTotal, remarks: row.remarks ?? "" };
      }
      out.push({ attemptId: row._id, title: paper.title, opensAt: row.opensAt, dueAt: row.dueAt, status: row.status, mark, accepted: row.acceptedAt !== undefined, excused: row.excused === true });
    }
    return out.sort((a, b) => b.dueAt - a.dueAt);
  },
});

// Named student results are shown to a teacher only through `staffRead` (house spec 0005): it checks that each student is in one of the teacher's
// classes, writes one record of the look for every student (the student sees it in Your data), and only then reads. A query cannot write, so this
// is a mutation the screen calls when it opens and after each mark. A page holds up to 50 students, the most a single read allows.
const PAGE = 50;
export const openForTeacher = mutation({
  args: { paperId: v.id("papers"), page: v.optional(v.number()) },
  returns: v.object({
    title: v.string(),
    questions: v.array(
      v.object({
        order: v.number(),
        kind: v.string(),
        subject: v.string(),
        topic: v.string(),
        text: v.string(),
        options: v.array(v.string()),
        rightOption: v.number(),
        maxMarks: v.number(),
        rubric: v.string(),
      }),
    ),
    total: v.number(),
    page: v.number(),
    attempts: v.array(
      v.object({
        attemptId: v.id("paperAttempts"),
        name: v.string(),
        status: v.string(),
        missed: v.boolean(),
        excused: v.boolean(),
        total: v.number(),
        remarks: v.string(),
        marks: v.array(v.object({ question: v.number(), mark: v.number() })),
        answers: v.array(v.object({ question: v.number(), choice: v.optional(v.number()), text: v.optional(v.string()) })),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) fail("slow_down");
    const paper = await ownPaper(ctx, mc.member._id, mc.member.instituteId, args.paperId);
    const page = Number.isInteger(args.page) && (args.page as number) >= 0 ? (args.page as number) : 0;
    const questions = (await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", args.paperId)).take(50)).sort((a, b) => a.order - b.order);
    const rows = await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", args.paperId)).take(500);
    const shown = {
      title: paper.title,
      questions: questions.map((q) => ({
        order: q.order,
        kind: q.kind,
        subject: q.subject,
        topic: q.topic,
        text: q.text,
        options: q.options ?? [],
        rightOption: q.rightOption ?? -1,
        maxMarks: q.maxMarks ?? 0,
        rubric: q.rubric ?? "",
      })),
      total: rows.length,
      page,
    };
    // Only students who are in one of this teacher's classes now. A student moved to another class, or one never in these classes, is left out
    // here instead of refusing the whole page.
    const mine: { row: Doc<"paperAttempts">; student: Doc<"members"> }[] = [];
    for (const row of rows.slice(page * PAGE, page * PAGE + PAGE)) {
      const student = await ctx.db.get(row.memberId);
      if (student && student.classId !== undefined && mc.classIds.includes(student.classId)) mine.push({ row, student });
    }
    if (mine.length === 0) return { ...shown, attempts: [] };
    return await staffRead(ctx, mc, { kind: "academic", targetMemberIds: mine.map((m) => m.student._id) }, async (allowed) => {
      const ok = new Set(allowed.map((s) => s._id));
      return {
        ...shown,
        attempts: mine
          .filter((m) => ok.has(m.student._id))
          .map(({ row, student }) => ({
            attemptId: row._id,
            name: student.name,
            status: row.status,
            missed: row.missed === true,
            excused: row.excused === true,
            total: (row.mcqCorrect ?? 0) + totalOf(row.marks ?? []),
            remarks: row.remarks ?? "",
            marks: row.marks ?? [],
            answers: row.answers ?? [],
          })),
      };
    });
  },
});

// The institute admin's academic preview (AC-7): the confirmed marks and remarks of the students of one class of the institute, and never an answer
// or a tag. Like the teacher's look it goes through `staffRead` (a record for every student shown), a page of up to 50 students at a time.
export const resultsForClass = mutation({
  args: { classId: v.id("classes"), page: v.optional(v.number()) },
  returns: v.object({
    total: v.number(),
    page: v.number(),
    students: v.array(
      v.object({
        name: v.string(),
        papers: v.array(v.object({ title: v.string(), total: v.number(), maxTotal: v.number(), remarks: v.string() })),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "institute_admin" || mc.member.instituteId === undefined) fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) fail("slow_down");
    const cls = await ctx.db.get(args.classId);
    if (!cls || cls.instituteId !== mc.member.instituteId) fail("forbidden");
    const page = Number.isInteger(args.page) && (args.page as number) >= 0 ? (args.page as number) : 0;
    const roster = (await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", args.classId)).take(500)).filter((m) => m.role === "student");
    const slice = roster.slice(page * PAGE, page * PAGE + PAGE);
    if (slice.length === 0) return { total: roster.length, page, students: [] };
    return await staffRead(ctx, mc, { kind: "academic", targetMemberIds: slice.map((m) => m._id) }, async (allowed) => {
      const students = [];
      // A paper's questions are read once for the whole page, not once for each student and paper.
      const maxOf = new Map<string, number>();
      for (const student of allowed) {
        const rows = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", student._id)).order("desc").take(100);
        const papers = [];
        for (const row of rows) {
          if (row.status !== "confirmed") continue;
          const paper = await ctx.db.get(row.paperId);
          if (!paper) continue;
          let maxTotal = maxOf.get(row.paperId);
          if (maxTotal === undefined) {
            const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", row.paperId)).take(50);
            maxTotal = questions.reduce((sum, q) => sum + (q.kind === "long" ? (q.maxMarks ?? 0) : 1), 0);
            maxOf.set(row.paperId, maxTotal);
          }
          papers.push({ title: paper.title, total: (row.mcqCorrect ?? 0) + totalOf(row.marks ?? []), maxTotal, remarks: row.remarks ?? "" });
        }
        students.push({ name: student.name, papers });
      }
      return { total: roster.length, page, students };
    });
  },
});

// A teacher's page for one student of their class (house spec 0026): every paper the student was sent, newest first, with its confirmed mark and
// remarks, or whether it was missed, excused or is still waiting. Never an answer, and nothing from a room. Through `staffRead`, so the student
// sees the look in Your data.
export const studentForTeacher = mutation({
  args: { memberId: v.id("members") },
  returns: v.object({
    name: v.string(),
    className: v.string(),
    papers: v.array(
      v.object({
        title: v.string(),
        dueAt: v.number(),
        state: v.union(v.literal("confirmed"), v.literal("missed"), v.literal("excused"), v.literal("waiting")),
        total: v.number(),
        maxTotal: v.number(),
        remarks: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) fail("slow_down");
    const target = await ctx.db.get(args.memberId);
    if (!target || target.role !== "student" || target.classId === undefined || !mc.classIds.includes(target.classId)) fail("forbidden");
    return await staffRead(ctx, mc, { kind: "academic", targetMemberIds: [target._id] }, async (allowed) => {
      if (allowed.length === 0) fail("not_found");
      const cls = target.classId ? await ctx.db.get(target.classId) : null;
      const papers = [];
      for (const row of await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", target._id)).order("desc").take(100)) {
        const paper = await ctx.db.get(row.paperId);
        if (!paper) continue;
        const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", row.paperId)).take(50);
        const confirmed = row.status === "confirmed";
        papers.push({
          title: paper.title,
          dueAt: row.dueAt,
          state: confirmed ? ("confirmed" as const) : row.excused === true ? ("excused" as const) : row.missed === true ? ("missed" as const) : ("waiting" as const),
          total: confirmed ? (row.mcqCorrect ?? 0) + totalOf(row.marks ?? []) : 0,
          maxTotal: questions.reduce((sum, q) => sum + (q.kind === "long" ? (q.maxMarks ?? 0) : 1), 0),
          remarks: confirmed ? (row.remarks ?? "") : "",
        });
      }
      return { name: target.name, className: cls ? `${cls.grade} ${cls.section}` : "", papers: papers.sort((a, b) => b.dueAt - a.dueAt) };
    });
  },
});

// A teacher marks a long answer by hand, with remarks. The teacher is the paper's teacher, or a teacher of the student's class.
export const markLong = mutation({
  args: { attemptId: v.id("paperAttempts"), marks: v.array(v.object({ question: v.number(), mark: v.number() })), remarks: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) fail("not_found");
    await authorizeAttempt(ctx, mc.member._id, attempt);
    if ((attempt.status !== "submitted" && attempt.status !== "marked") || attempt.excused === true) fail("not_submitted");
    const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", attempt.paperId)).take(50);
    // One mark for each question: the same question twice would be added twice.
    if (new Set(args.marks.map((m) => m.question)).size !== args.marks.length) fail("bad_mark");
    for (const m of args.marks) {
      const q = questions.find((x) => x.order === m.question);
      if (!q || q.kind !== "long") fail("bad_mark");
      if (markProblem(m.mark, q.maxMarks ?? 0)) fail("bad_mark");
    }
    if ([...args.remarks].length > 1000) fail("bad_remarks");
    await ctx.db.patch(args.attemptId, { marks: args.marks, remarks: args.remarks.trim(), status: "marked", markedBy: mc.member._id, markedAt: Date.now() });
    return { ok: true as const };
  },
});

// The teacher confirms a mark. Only a confirmed mark is shown to the student.
export const confirm = mutation({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) fail("not_found");
    await authorizeAttempt(ctx, mc.member._id, attempt);
    if (attempt.status !== "marked") fail("not_marked");
    await ctx.db.patch(args.attemptId, { status: "confirmed", confirmedAt: Date.now() });
    return { ok: true as const };
  },
});

// The paper's teacher, or a teacher of the student's class, in the same institute.
async function authorizeAttempt(ctx: MutationCtx, teacherId: Id<"members">, attempt: Doc<"paperAttempts">) {
  const paper = await ctx.db.get(attempt.paperId);
  if (!paper) fail("not_found");
  const teacher = await ctx.db.get(teacherId);
  if (!teacher || teacher.instituteId !== attempt.instituteId) fail("forbidden");
  if (paper.teacherMemberId === teacherId) return;
  const student = await ctx.db.get(attempt.memberId);
  if (!student?.classId) fail("forbidden");
  const mine = await teacherClassIds(ctx, teacherId);
  if (!mine.includes(student.classId)) fail("forbidden");
}

// The papers this teacher built, newest first, with their status (for the teacher's own list).
export const mineAsTeacher = query({
  args: {},
  returns: v.array(v.object({ paperId: v.id("papers"), title: v.string(), status: v.string() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const rows = await ctx.db.query("papers").withIndex("by_teacherMemberId", (q) => q.eq("teacherMemberId", mc.member._id)).order("desc").take(100);
    return rows.map((r) => ({ paperId: r._id, title: r.title, status: r.status }));
  },
});
