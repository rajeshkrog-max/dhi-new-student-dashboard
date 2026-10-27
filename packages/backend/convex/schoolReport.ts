// The school report (house spec 0025; the owner's answers of 2026-10-27). For one class and a range of days: the papers sent to the class, how many
// were sat on time or missed, the class's multiple choice share by subject and by topic and week, the "re-teach" actions (CR1) and the academic
// support list, all from the papers' own tables. Never the Brain, the desk or a wellbeing room: the room counts are the existing `classTotal`, for
// the institute admin only. Seen by the institute admin (any class of their institute) and a teacher (their own classes); a DHI admin or a counselor
// never. Opening it writes one access log row; the named support list goes through `staffRead`, so each listed student sees the look in Your data.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { TOTAL_KINDS } from "./accessRules";
import { dayBounds, dayOf, isDayKey } from "./dayRules";
import { fail } from "./helpers";
import { logAccess, requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { reportOf, rangeProblem, type Attempt, type Question } from "./schoolRules";
import { classTotal, STAFF_READ_MAX, staffRead, standingOf } from "./staffRead";

const SENDS_MAX = 200;
const ROSTER_MAX = 500;

const share = { students: v.number(), pct: v.union(v.number(), v.null()) };
const reportValidator = v.object({
  className: v.string(),
  students: v.number(),
  papers: v.number(),
  closed: v.number(),
  sat: v.number(),
  missed: v.number(),
  excused: v.number(),
  weeks: v.array(v.string()),
  subjects: v.array(v.object({ subject: v.string(), ...share, change: v.union(v.number(), v.null()) })),
  topics: v.array(
    v.object({
      subject: v.string(),
      topic: v.string(),
      ...share,
      cells: v.array(v.object({ week: v.string(), ...share, band: v.union(v.literal("low"), v.literal("mid"), v.literal("high"), v.null()) })),
    }),
  ),
  actions: v.array(v.object({ kind: v.literal("reteach"), subject: v.string(), topic: v.string(), pct: v.number(), gain: v.number() })),
  support: v.array(v.object({ name: v.string(), reasons: v.array(v.union(v.literal("missed_in_a_row"), v.literal("accuracy_down"))) })),
});

// The class, if this person may see its report: an institute admin of its institute, or a teacher it is assigned to.
async function reportClass(ctx: MutationCtx, mc: MemberContext, classId: Id<"classes">): Promise<Doc<"classes">> {
  const cls = await ctx.db.get(classId);
  if (!cls) fail("forbidden");
  if (mc.role === "institute_admin" && mc.member.instituteId !== undefined && cls.instituteId === mc.member.instituteId) return cls;
  if (mc.role === "teacher" && mc.classIds.includes(classId)) return cls;
  return fail("forbidden");
}

export const forClass = mutation({
  args: { classId: v.id("classes"), fromDay: v.string(), toDay: v.string() },
  returns: v.union(reportValidator, v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const cls = await reportClass(ctx, mc, args.classId);
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) fail("slow_down");
    if (!isDayKey(args.fromDay) || !isDayKey(args.toDay)) return { ok: false as const, code: "bad_range" };
    const problem = rangeProblem(args.fromDay, args.toDay);
    if (problem) return { ok: false as const, code: problem };

    // Only the students who stand in the class now and are through consent; a withdrawn, removed or erased student counts nowhere.
    const roster = (await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", cls._id)).take(ROSTER_MAX)).filter((m) => m.role === "student");
    const inClass = new Set<Id<"members">>();
    for (const m of roster) if ((await standingOf(ctx, m)) === "ok") inClass.add(m._id);

    const from = dayBounds(args.fromDay).start;
    const to = dayBounds(args.toDay).end;
    const now = Date.now();
    const sends = await ctx.db
      .query("paperSends")
      .withIndex("by_classId_and_dueAt", (q) => q.eq("classId", cls._id).gte("dueAt", from).lt("dueAt", to))
      .take(SENDS_MAX);
    const questions = new Map<string, Question[]>();
    const attempts: Attempt[] = [];
    for (const send of sends) {
      if (!questions.has(send.paperId)) {
        const qs = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", send.paperId)).take(50);
        questions.set(send.paperId, qs.map((q) => ({ order: q.order, kind: q.kind, subject: q.subject, topic: q.topic, rightOption: q.rightOption })));
      }
      const rows = await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", send.paperId)).take(ROSTER_MAX);
      for (const row of rows) {
        if (!inClass.has(row.memberId) || row.dueAt !== send.dueAt) continue;
        attempts.push({
          memberId: row.memberId,
          paperId: row.paperId,
          day: dayOf(row.dueAt),
          dueAt: row.dueAt,
          closed: row.dueAt <= now,
          status: row.status,
          missed: row.missed === true,
          excused: row.excused === true,
          answers: (row.answers ?? []).map((a) => ({ question: a.question, ...(a.choice !== undefined ? { choice: a.choice } : {}) })),
        });
      }
    }
    const { support, ...totals } = reportOf(attempts, questions);
    await logAccess(ctx, { actor: mc.member._id, action: "school.report", instituteId: cls.instituteId });

    // The named list, A to Z: read through `staffRead` (one view row a student, the student sees it), 50 at a time.
    const named: { name: string; reasons: ("missed_in_a_row" | "accuracy_down")[] }[] = [];
    const ids = support.map((s) => s.memberId as Id<"members">);
    for (let i = 0; i < ids.length; i += STAFF_READ_MAX) {
      const chunk = ids.slice(i, i + STAFF_READ_MAX);
      const names = await staffRead(ctx, mc, { kind: "academic", targetMemberIds: chunk }, async (allowed) => allowed.map((m) => ({ id: m._id as string, name: m.name })));
      for (const n of names) {
        const reasons = support.find((s) => s.memberId === n.id)?.reasons ?? [];
        named.push({ name: n.name, reasons });
      }
    }
    named.sort((a, b) => a.name.localeCompare(b.name));

    return { className: `${cls.grade} ${cls.section}`, students: inClass.size, ...totals, support: named };
  },
});

// The counts of the wellbeing rooms for one complete month (owner, 2026-10-27): how many students of the class logged anything in each room, through
// `classTotal`, shown only when 10 or more stand behind a number. The institute admin only, as `classTotal` already rules.
export const roomCounts = mutation({
  args: { classId: v.id("classes"), month: v.string() },
  returns: v.array(v.object({ kind: v.string(), count: v.union(v.number(), v.null()) })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "institute_admin") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) fail("slow_down");
    const out = [];
    for (const kind of TOTAL_KINDS) out.push({ kind, count: (await classTotal(ctx, mc, { classId: args.classId, kind, month: args.month }))?.count ?? null });
    return out;
  },
});
