// Counseling (spec house/0024; the owner's answers of 2026-10-27). A counselor opens their own 30 minute slots; a student books one, with one open
// booking at a time, and may write a short note. The counselor sees the student's first name, class, school, the time and the note, and nothing from
// the rooms. The session is a Stream Video call inside the house (counselCall.ts): recorded and transcribed on Stream, never copied into a DHI table.
// After it the counselor may write a short summary, which only that student and that counselor read, and may share the recording with a person on
// request. School staff and DHI admins never see a booking. Every function starts with `requireMember`; a refusal after a limit is returned.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { NOTE_MAX, OPEN_SLOTS_MAX, SHARES_MAX, SLOT_MS, STUDENT_DAYS_SHOWN, SUMMARY_MAX, callOpenAt, cleanText, firstName, slotProblem } from "./counselRules";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";

const DAY_MS = 24 * 60 * 60 * 1000;
const refused = v.object({ ok: v.literal(false), code: v.string() });
const ok = v.object({ ok: v.literal(true) });

const requireCounselor = async (ctx: QueryCtx | MutationCtx): Promise<MemberContext> => {
  const mc = await requireMember(ctx);
  if (mc.role !== "counselor") fail("forbidden");
  return mc;
};
const requireStudent = async (ctx: QueryCtx | MutationCtx): Promise<MemberContext> => {
  const mc = await requireMember(ctx);
  if (mc.role !== "student") fail("forbidden");
  return mc;
};

// What a counselor is shown about the student of a booking: the first name, class and school only.
async function studentCard(ctx: QueryCtx, memberId: Id<"members">) {
  const m = await ctx.db.get(memberId);
  if (!m) return { firstName: "", className: "", school: "" };
  const cls = m.classId ? await ctx.db.get(m.classId) : null;
  const inst = m.instituteId ? await ctx.db.get(m.instituteId) : null;
  return { firstName: firstName(m.name), className: cls ? `${cls.grade} ${cls.section}` : "", school: inst?.name ?? "" };
}

const bookingView = v.object({
  bookingId: v.id("counselBookings"),
  status: v.string(),
  firstName: v.string(),
  className: v.string(),
  school: v.string(),
  note: v.string(),
  summary: v.string(),
  shares: v.number(),
});

// ---- The counselor ----

// The counselor's own slots from a day back, oldest first, each with its booking (if any). `now` is the screen's clock (a query does not rerun by
// the clock alone); it only chooses the window.
export const mySlots = query({
  args: { now: v.number() },
  returns: v.array(v.object({ slotId: v.id("counselSlots"), startsAt: v.number(), endsAt: v.number(), status: v.string(), booking: v.union(v.null(), bookingView) })),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    const slots = await ctx.db
      .query("counselSlots")
      .withIndex("by_counselorMemberId_and_startsAt", (q) => q.eq("counselorMemberId", mc.member._id).gte("startsAt", args.now - DAY_MS))
      .take(OPEN_SLOTS_MAX + 100);
    const out = [];
    for (const s of slots) {
      if (s.status === "closed") continue;
      const b = (await ctx.db.query("counselBookings").withIndex("by_slotId", (q) => q.eq("slotId", s._id)).take(10)).find((x) => x.status === "booked" || x.status === "done") ?? null;
      const shares = b ? (await ctx.db.query("counselShares").withIndex("by_bookingId", (q) => q.eq("bookingId", b._id)).take(SHARES_MAX + 1)).length : 0;
      out.push({
        slotId: s._id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        booking: b ? { bookingId: b._id, status: b.status, ...(await studentCard(ctx, b.memberId)), note: b.note ?? "", summary: b.summary ?? "", shares } : null,
      });
    }
    return out;
  },
});

// The counselor opens one 30 minute slot of their own.
export const openSlot = mutation({
  args: { startsAt: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), slotId: v.id("counselSlots") }), refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    if (!(await rateLimiter.limit(ctx, "counselWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const now = Date.now();
    const problem = slotProblem(args.startsAt, now);
    if (problem) return { ok: false as const, code: problem };
    const mine = await ctx.db
      .query("counselSlots")
      .withIndex("by_counselorMemberId_and_startsAt", (q) => q.eq("counselorMemberId", mc.member._id).gte("startsAt", now))
      .take(OPEN_SLOTS_MAX + 1);
    if (mine.filter((s) => s.status === "open").length >= OPEN_SLOTS_MAX) return { ok: false as const, code: "too_many_slots" };
    if (mine.some((s) => s.startsAt === args.startsAt && s.status !== "closed")) return { ok: false as const, code: "slot_taken" };
    const slotId = await ctx.db.insert("counselSlots", { counselorMemberId: mc.member._id, startsAt: args.startsAt, endsAt: args.startsAt + SLOT_MS, status: "open", createdAt: now });
    return { ok: true as const, slotId };
  },
});

// The counselor takes back a slot nobody booked.
export const closeSlot = mutation({
  args: { slotId: v.id("counselSlots") },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    if (!(await rateLimiter.limit(ctx, "counselWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const s = await ctx.db.get(args.slotId);
    if (!s || s.counselorMemberId !== mc.member._id) return { ok: false as const, code: "not_found" };
    if (s.status !== "open") return { ok: false as const, code: "booked" };
    await ctx.db.patch(s._id, { status: "closed" });
    return { ok: true as const };
  },
});

async function ownBooking(ctx: MutationCtx, mc: MemberContext, bookingId: Id<"counselBookings">, as: "counselor" | "student"): Promise<Doc<"counselBookings"> | null> {
  const b = await ctx.db.get(bookingId);
  if (!b) return null;
  return (as === "counselor" ? b.counselorMemberId : b.memberId) === mc.member._id ? b : null;
}

// The counselor cancels a booking before it starts; the slot opens again.
export const cancelByCounselor = mutation({
  args: { bookingId: v.id("counselBookings") },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    if (!(await rateLimiter.limit(ctx, "counselWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const b = await ownBooking(ctx, mc, args.bookingId, "counselor");
    if (!b || b.status !== "booked") return { ok: false as const, code: "not_found" };
    if (Date.now() >= b.startsAt) return { ok: false as const, code: "started" };
    await ctx.db.patch(b._id, { status: "cancelled_by_counselor" });
    await ctx.db.patch(b.slotId, { status: "open" });
    return { ok: true as const };
  },
});

// After the session has started, the counselor marks it done and may write a short summary (only this student and this counselor read it).
export const finish = mutation({
  args: { bookingId: v.id("counselBookings"), summary: v.string() },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    if (!(await rateLimiter.limit(ctx, "counselWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const b = await ownBooking(ctx, mc, args.bookingId, "counselor");
    if (!b || (b.status !== "booked" && b.status !== "done")) return { ok: false as const, code: "not_found" };
    if (Date.now() < b.startsAt) return { ok: false as const, code: "not_started" };
    const summary = cleanText(args.summary, SUMMARY_MAX);
    if (summary === null) return { ok: false as const, code: "summary_too_long" };
    await ctx.db.patch(b._id, { status: "done", summary: summary || undefined, summaryAt: summary ? Date.now() : undefined });
    return { ok: true as const };
  },
});

// On request, the counselor lets one person of the house open this session's recording and transcript, by their email (owner, 2026-10-27). Only
// a person who has joined the house can be named; a shared person sees only the recording, never the note or the summary.
export const shareRecording = mutation({
  args: { bookingId: v.id("counselBookings"), email: v.string() },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    if (!(await rateLimiter.limit(ctx, "counselWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const b = await ownBooking(ctx, mc, args.bookingId, "counselor");
    if (!b || (b.status !== "booked" && b.status !== "done")) return { ok: false as const, code: "not_found" };
    const email = args.email.trim().toLowerCase();
    const who = email ? await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", email)).first() : null;
    if (!who || who.erasedAt !== undefined || who.status !== "active") return { ok: false as const, code: "no_such_person" };
    if (who._id === mc.member._id) return { ok: false as const, code: "already_yours" };
    const existing = await ctx.db.query("counselShares").withIndex("by_bookingId", (q) => q.eq("bookingId", b._id)).take(SHARES_MAX + 1);
    if (existing.some((s) => s.memberId === who._id)) return { ok: true as const };
    if (existing.length >= SHARES_MAX) return { ok: false as const, code: "too_many_shares" };
    await ctx.db.insert("counselShares", { bookingId: b._id, memberId: who._id, sharedBy: mc.member._id, at: Date.now() });
    return { ok: true as const };
  },
});

// The counselor takes a share back.
export const unshareRecording = mutation({
  args: { bookingId: v.id("counselBookings"), email: v.string() },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireCounselor(ctx);
    const b = await ownBooking(ctx, mc, args.bookingId, "counselor");
    if (!b) return { ok: false as const, code: "not_found" };
    const who = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase())).first();
    for (const s of await ctx.db.query("counselShares").withIndex("by_bookingId", (q) => q.eq("bookingId", b._id)).take(SHARES_MAX + 1)) {
      if (who && s.memberId === who._id) await ctx.db.delete(s._id);
    }
    return { ok: true as const };
  },
});

// ---- The student ----

// Free slots of every counselor over the next two weeks, soonest first, with the counselor's first name. `now` as in `mySlots`.
export const freeSlots = query({
  args: { now: v.number() },
  returns: v.array(v.object({ slotId: v.id("counselSlots"), startsAt: v.number(), endsAt: v.number(), counselor: v.string() })),
  handler: async (ctx, args) => {
    await requireStudent(ctx);
    const rows = await ctx.db
      .query("counselSlots")
      .withIndex("by_status_and_startsAt", (q) => q.eq("status", "open").gt("startsAt", args.now).lt("startsAt", args.now + STUDENT_DAYS_SHOWN * DAY_MS))
      .take(300);
    const names = new Map<string, string>();
    const out = [];
    for (const s of rows) {
      if (!names.has(s.counselorMemberId)) names.set(s.counselorMemberId, firstName((await ctx.db.get(s.counselorMemberId))?.name ?? ""));
      out.push({ slotId: s._id, startsAt: s.startsAt, endsAt: s.endsAt, counselor: names.get(s.counselorMemberId) ?? "" });
    }
    return out;
  },
});

// The student books a free slot, with an optional note of up to 300 letters. One open booking at a time.
export const book = mutation({
  args: { slotId: v.id("counselSlots"), note: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), bookingId: v.id("counselBookings") }), refused),
  handler: async (ctx, args) => {
    const mc = await requireStudent(ctx);
    if (!(await rateLimiter.limit(ctx, "counselBook", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const note = cleanText(args.note, NOTE_MAX);
    if (note === null) return { ok: false as const, code: "note_too_long" };
    const now = Date.now();
    const open = (await ctx.db.query("counselBookings").withIndex("by_memberId_and_startsAt", (q) => q.eq("memberId", mc.member._id).gte("startsAt", now)).take(20)).some(
      (b) => b.status === "booked",
    );
    if (open) return { ok: false as const, code: "already_booked" };
    const s = await ctx.db.get(args.slotId);
    if (!s || s.status !== "open" || s.startsAt <= now) return { ok: false as const, code: "slot_gone" };
    await ctx.db.patch(s._id, { status: "booked" });
    const bookingId = await ctx.db.insert("counselBookings", {
      slotId: s._id,
      counselorMemberId: s.counselorMemberId,
      memberId: mc.member._id,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      startsAt: s.startsAt,
      ...(note ? { note } : {}),
      status: "booked",
      createdAt: now,
    });
    return { ok: true as const, bookingId };
  },
});

// The student cancels their own booking before it starts; the slot opens again.
export const cancel = mutation({
  args: { bookingId: v.id("counselBookings") },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const mc = await requireStudent(ctx);
    if (!(await rateLimiter.limit(ctx, "counselBook", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    const b = await ownBooking(ctx, mc, args.bookingId, "student");
    if (!b || b.status !== "booked") return { ok: false as const, code: "not_found" };
    if (Date.now() >= b.startsAt) return { ok: false as const, code: "started" };
    await ctx.db.patch(b._id, { status: "cancelled_by_student" });
    await ctx.db.patch(b.slotId, { status: "open" });
    return { ok: true as const };
  },
});

// The student's own bookings, newest first: the time, the counselor's first name, the status, their note and the counselor's summary.
export const mine = query({
  args: {},
  returns: v.array(
    v.object({ bookingId: v.id("counselBookings"), startsAt: v.number(), endsAt: v.number(), counselor: v.string(), status: v.string(), note: v.string(), summary: v.string() }),
  ),
  handler: async (ctx) => {
    const mc = await requireStudent(ctx);
    const rows = await ctx.db.query("counselBookings").withIndex("by_memberId_and_startsAt", (q) => q.eq("memberId", mc.member._id)).order("desc").take(30);
    const out = [];
    for (const b of rows) {
      const counselor = firstName((await ctx.db.get(b.counselorMemberId))?.name ?? "");
      out.push({ bookingId: b._id, startsAt: b.startsAt, endsAt: b.startsAt + SLOT_MS, counselor, status: b.status, note: b.note ?? "", summary: b.summary ?? "" });
    }
    return out;
  },
});

// Recordings a counselor shared with the signed in person (any role): the session's time and the counselor's first name, to open from the house.
export const sharedWithMe = query({
  args: {},
  returns: v.array(v.object({ bookingId: v.id("counselBookings"), startsAt: v.number(), counselor: v.string() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    const out = [];
    for (const s of await ctx.db.query("counselShares").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(50)) {
      const b = await ctx.db.get(s.bookingId);
      if (b) out.push({ bookingId: b._id, startsAt: b.startsAt, counselor: firstName((await ctx.db.get(b.counselorMemberId))?.name ?? "") });
    }
    return out;
  },
});

// ---- For counselCall.ts (internal): who the signed in person is to a booking ----

// The two members of a booking's call, and whether the caller may join it now, or open its recording. Read with the caller's own identity.
export const callAccess = internalQuery({
  args: { bookingId: v.id("counselBookings"), now: v.number() },
  returns: v.union(
    v.object({ ok: v.literal(false), code: v.string() }),
    v.object({
      ok: v.literal(true),
      me: v.object({ id: v.string(), name: v.string() }),
      counselor: v.object({ id: v.string(), name: v.string() }),
      student: v.object({ id: v.string(), name: v.string() }),
      mayJoin: v.boolean(),
      mayWatch: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b) return { ok: false as const, code: "not_found" };
    const isCounselor = mc.role === "counselor" && b.counselorMemberId === mc.member._id;
    const isStudent = mc.role === "student" && b.memberId === mc.member._id;
    const shared = (await ctx.db.query("counselShares").withIndex("by_bookingId", (q) => q.eq("bookingId", b._id)).take(SHARES_MAX + 1)).some((s) => s.memberId === mc.member._id);
    if (!isCounselor && !isStudent && !shared) return { ok: false as const, code: "not_found" };
    const counselor = await ctx.db.get(b.counselorMemberId);
    const student = await ctx.db.get(b.memberId);
    const open = b.status === "booked" && callOpenAt(b.startsAt, b.startsAt + SLOT_MS, args.now);
    return {
      ok: true as const,
      me: { id: mc.member._id as string, name: firstName(mc.member.name) },
      counselor: { id: b.counselorMemberId as string, name: firstName(counselor?.name ?? "") },
      student: { id: b.memberId as string, name: firstName(student?.name ?? "") },
      mayJoin: (isCounselor || isStudent) && open,
      mayWatch: isCounselor || shared,
    };
  },
});
