// The two ways staff see anything about a student's room data (spec house/0005, AC-7, AC-10, AC-23). Nothing else may return a student's named
// data to a teacher or an institute admin, and a DHI admin or a counselor gets none.
//
//   staffRead   named data (a teacher: exam results of an assigned class; an institute admin: exam results of their institute). It checks
//               `canView`, writes one `viewLog` row for each student and kind, and only then reads. A Convex query cannot write, so a function that
//               shows named data is a mutation that loads on open or refresh.
//   classTotal  a total for a whole class, for the wellbeing kinds, and only when 10 or more students stand behind it.
//
// The roster (name, email, class, under 18) is how staff run access and is not a view. Rows hold ids and codes only.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { canView, isDataKind, MIN_TOTAL, ROOM_KINDS, TOTAL_KINDS, type DataKind, type Relation, type Standing, type Viewer } from "./accessRules";
import { gateOf } from "./consentState";
import { isDayKey, shiftDay, todayOf } from "./dayRules";
import { hasEventInRange } from "./eventLog";
import { fail } from "./helpers";
import { logAccess, type MemberContext } from "./houseAuth";

export const STAFF_READ_MAX = 50;

// Where a student stands for anyone but themselves: withdrawn, removed, erased or not yet through consent is invisible (AC-7).
export async function standingOf(ctx: MutationCtx, target: Doc<"members">): Promise<Standing> {
  if (target.erasedAt !== undefined) return "erased";
  if (target.status !== "active") return "removed";
  if (target.instituteId) {
    const institute = await ctx.db.get(target.instituteId);
    if (!institute || institute.status === "suspended") return "removed";
  }
  return (await gateOf(ctx, target)).state === "ok" ? "ok" : "locked";
}

function relationOf(mc: MemberContext, target: Doc<"members">): Relation {
  if (mc.role === "teacher") return target.classId !== undefined && mc.classIds.includes(target.classId) ? "assigned_class" : "none";
  if (mc.role === "institute_admin") return mc.member.instituteId !== undefined && target.instituteId === mc.member.instituteId ? "same_institute" : "none";
  return "none";
}

// Reads named data for one or more students (up to 50) of one kind. `read` receives the students the caller may see and is called after their
// view rows are written. A target outside the caller's reach (another institute, a class that is not theirs) refuses the whole call with
// `forbidden`. A target who is withdrawn, removed, erased or not yet through consent is left out without a word, and leaves no view row.
export async function staffRead<T>(
  ctx: MutationCtx,
  mc: MemberContext,
  args: { kind: DataKind; targetMemberIds: Id<"members">[] },
  read: (targets: Doc<"members">[]) => Promise<T>,
): Promise<T> {
  if (!isDataKind(args.kind)) fail("bad_kind");
  const ids = [...new Set(args.targetMemberIds)];
  if (ids.length === 0 || ids.length > STAFF_READ_MAX) fail("bad_request");
  const allowed: Doc<"members">[] = [];
  for (const id of ids) {
    const target = await ctx.db.get(id);
    if (!target || target.role !== "student") fail("not_found");
    const reach = canView(mc.role as Viewer, relationOf(mc, target), args.kind, { standing: "ok" });
    // `named` is the only reach a read can serve. Totals go through `classTotal`; the roster has its own scoped functions.
    if (reach !== "named") fail("forbidden");
    if ((await standingOf(ctx, target)) === "ok") allowed.push(target);
  }
  const at = Date.now();
  for (const target of allowed) {
    await ctx.db.insert("viewLog", {
      viewerId: mc.member._id,
      viewerRole: mc.role,
      targetMemberId: target._id,
      instituteId: target.instituteId,
      kind: args.kind,
      at,
    });
  }
  return await read(allowed);
}

// A total can be asked for one complete calendar month at a time ("YYYY-MM"), within the last 12 months. One period, no narrower cut by day,
// group or section, and no filter: nothing overlaps, so two answers cannot be subtracted to find one student (AC-23).
export const TOTAL_MONTHS_BACK = 12;

export function monthDays(month: string, now: number): { fromDay: string; toDay: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const fromDay = `${month}-01`;
  if (!isDayKey(fromDay)) return null;
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const toDay = shiftDay(next, -1);
  const today = todayOf(now);
  // A complete month only: its last day is before today, so the total never moves while it is being looked at.
  if (toDay >= today) return null;
  const thisMonth = `${today.slice(0, 8)}01`;
  let oldest = thisMonth;
  for (let i = 0; i < TOTAL_MONTHS_BACK; i++) oldest = shiftDay(oldest, -1).slice(0, 8) + "01";
  if (fromDay < oldest) return null;
  return { fromDay, toDay };
}

// A class total of one wellbeing kind for one complete month: the number of distinct active students of one current class, through consent and
// not withdrawn or erased, who have data of that kind in the period. Nothing is returned when fewer than 10 stand behind it. One access log row
// is written for every call, including one that returns nothing. Institute admins only.
export async function classTotal(
  ctx: MutationCtx,
  mc: MemberContext,
  args: { classId: Id<"classes">; kind: DataKind; month: string },
): Promise<{ count: number } | null> {
  if (mc.role !== "institute_admin" || !mc.member.instituteId) fail("forbidden");
  if (!TOTAL_KINDS.includes(args.kind)) fail("forbidden");
  const cls = await ctx.db.get(args.classId);
  if (!cls || cls.instituteId !== mc.member.instituteId) fail("forbidden");
  const now = Date.now();
  const days = monthDays(args.month, now);
  if (!days) fail("bad_period");
  const month = args.month;
  const rooms = Object.entries(ROOM_KINDS)
    .filter(([, kinds]) => kinds.includes(args.kind))
    .map(([room]) => room);

  await logAccess(ctx, { actor: mc.member._id, action: "totals.read", instituteId: cls.instituteId });
  const classId = args.classId;
  // A total is worked out once and served as it was (see the classTotals table), so moving or pausing a student between two asks changes nothing.
  const kind = args.kind;
  const first = await ctx.db
    .query("classTotals")
    .withIndex("by_classId_and_kind_and_month", (q) => q.eq("classId", classId).eq("kind", kind).eq("month", month))
    .first();
  if (first) return first.count === undefined ? null : { count: first.count };
  const students = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", classId)).take(1000);
  let count = 0;
  for (const s of students) {
    if (s.role !== "student" || (await standingOf(ctx, s)) !== "ok") continue;
    if (await hasEventInRange(ctx, { memberId: s._id, rooms, fromDay: days.fromDay, toDay: days.toDay })) count += 1;
  }
  await ctx.db.insert("classTotals", { classId, kind, month, ...(count >= MIN_TOTAL ? { count } : {}) });
  return count >= MIN_TOTAL ? { count } : null;
}

