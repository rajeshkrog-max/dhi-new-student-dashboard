// The study hour (spec house/0015). A DHI admin sets the hour. A student enters a seat only while it is open, as Live, Away or Do not disturb, and
// their browser sends a heartbeat; a seat with no heartbeat for 60 seconds is dropped, and so is every seat when the hour closes. Seats and chat are
// split by institute: a student sees only their own institute's. Do not disturb hides the student from others and shows them no one and no chat.
// Every chat message is stored, so a teacher or a DHI admin can review it, and a student can report one. When a seat ends, one `hour.present`
// event holds the whole minutes the student was there. Every function starts with `requireMember` or `requireDhiAdmin`, so the consent gate applies.
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { recordEvent, recordSystemEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireDhiAdmin, requireMember, teacherClassIds, type MemberContext } from "./houseAuth";
import { asksForCard } from "./sessionRules";
import { rateLimiter } from "./limits";
import {
  MAX_HOUR_MS,
  MESSAGES_SHOWN,
  canSee,
  cleanMessage,
  isMode,
  isOpenAt,
  leftTimeOf,
  lateMinutes,
  minutesPresent,
  overlaps,
  seatIsCurrent,
  windowProblem,
  type Mode,
} from "./hourRules";

type Actor = Pick<MemberContext, "member" | "role" | "classIds">;

const hourView = v.object({ hourId: v.id("studyHours"), opensAt: v.number(), closesAt: v.number() });
const refused = v.object({ ok: v.literal(false), code: v.string() });

// DHI admin: sets an hour. It must close in the future, last from 5 minutes to 8 hours, and not overlap another hour.
export const set = mutation({
  args: { opensAt: v.number(), closesAt: v.number() },
  returns: v.id("studyHours"),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const problem = windowProblem(args.opensAt, args.closesAt);
    if (problem) fail(problem);
    if (args.closesAt <= Date.now()) fail("bad_window");
    const near = await ctx.db
      .query("studyHours")
      .withIndex("by_opensAt", (q) => q.gte("opensAt", args.opensAt - MAX_HOUR_MS).lte("opensAt", args.closesAt))
      .take(50);
    if (near.some((h) => overlaps(h, args))) fail("overlap");
    return await ctx.db.insert("studyHours", { opensAt: args.opensAt, closesAt: args.closesAt, setBy: mc.member._id, createdAt: Date.now() });
  },
});

// DHI admin: the most recent hours and the upcoming ones, newest first.
export const hours = query({
  args: {},
  returns: v.array(hourView),
  handler: async (ctx) => {
    await requireDhiAdmin(ctx);
    const rows = await ctx.db.query("studyHours").withIndex("by_opensAt").order("desc").take(20);
    return rows.map((h) => ({ hourId: h._id, opensAt: h.opensAt, closesAt: h.closesAt }));
  },
});

// The hour open right now, if any (the latest to have opened that has not closed).
async function openHour(ctx: QueryCtx | MutationCtx, now: number): Promise<Doc<"studyHours"> | null> {
  const recent = await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.lte("opensAt", now)).order("desc").take(3);
  return recent.find((h) => now < h.closesAt) ?? null;
}

// Ends a seat: it is marked left, and a stay of a minute or more writes one presence event (as the student when they leave themselves, as the
// system when the heartbeat stopped or the hour closed). A refusal from the log (a withdrawn consent, say) does not stop the seat from ending.
async function endSeat(ctx: MutationCtx, seat: Doc<"seats">, hour: Doc<"studyHours">, now: number, by: Actor | null): Promise<void> {
  // A student who leaves a seat that is still current counts until now; a seat whose heartbeat stopped counts until its last heartbeat.
  const leaving = by !== null && seatIsCurrent(seat, hour, now);
  const leftAt = Math.max(seat.enteredAt, leftTimeOf(seat, hour, now, leaving));
  const minutes = minutesPresent(seat.enteredAt, leftAt);
  // A stay long enough asks for the after session card (spec house/0018).
  await ctx.db.patch(seat._id, { leftAt, ...(asksForCard("hour", minutes) ? { feedbackStatus: "pending" } : {}) });
  if (minutes < 1) return;
  const input = { memberId: seat.memberId, room: "hour", type: "hour.present", payload: { minutes, lateMinutes: lateMinutes(seat.enteredAt, leftAt) }, occurredAt: leftAt, eventKey: `seat:${seat._id}-0`, about: `seat:${seat._id}` };
  try {
    if (by) await recordEvent(ctx, { by, ...input });
    else await recordSystemEvent(ctx, input);
  } catch {
    // The seat has ended whatever the log says; the minutes of a student who withdrew are not recorded.
  }
}

// The student's current seat in an hour (not left), or null.
async function seatOf(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, hourId: Id<"studyHours">): Promise<Doc<"seats"> | null> {
  const latest = await ctx.db.query("seats").withIndex("by_memberId_and_hourId", (q) => q.eq("memberId", memberId).eq("hourId", hourId)).order("desc").first();
  return latest && latest.leftAt === undefined ? latest : null;
}

// The state a student's screen starts from: the hour open now or the next one, and the student's own seat in it.
export const current = query({
  args: {},
  returns: v.object({
    state: v.string(), // "open", "upcoming" or "none"
    hour: v.union(hourView, v.null()),
    mySeat: v.union(v.object({ mode: v.string() }), v.null()),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const open = await openHour(ctx, now);
    if (open) {
      const seat = await seatOf(ctx, mc.member._id, open._id);
      const live = seat !== null && seatIsCurrent(seat, open, now);
      return { state: "open", hour: { hourId: open._id, opensAt: open.opensAt, closesAt: open.closesAt }, mySeat: live ? { mode: seat.mode } : null };
    }
    const next = (await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.gt("opensAt", now)).take(1))[0];
    return next ? { state: "upcoming", hour: { hourId: next._id, opensAt: next.opensAt, closesAt: next.closesAt }, mySeat: null } : { state: "none", hour: null, mySeat: null };
  },
});

// Enters a seat, or changes the mode of the seat the student already has. Only while the hour is open.
export const enter = mutation({
  args: { mode: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "hourSeat", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (!isMode(args.mode)) return { ok: false as const, code: "bad_mode" };
    const now = Date.now();
    const hour = await openHour(ctx, now);
    if (!hour) {
      const upcoming = await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.gt("opensAt", now)).take(1);
      return { ok: false as const, code: upcoming.length > 0 ? "not_open" : "closed" };
    }
    const existing = await seatOf(ctx, mc.member._id, hour._id);
    if (existing && seatIsCurrent(existing, hour, now)) {
      await ctx.db.patch(existing._id, { mode: args.mode, lastBeatAt: now });
      return { ok: true as const };
    }
    // A seat whose heartbeat stopped is closed first, then a fresh seat starts.
    if (existing) await endSeat(ctx, existing, hour, now, null);
    await ctx.db.insert("seats", {
      hourId: hour._id,
      memberId: mc.member._id,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      mode: args.mode,
      enteredAt: now,
      lastBeatAt: now,
    });
    return { ok: true as const };
  },
});

// The heartbeat. It keeps the seat, and tells the screen whether the hour is still open.
export const beat = mutation({
  args: {},
  returns: v.object({ open: v.boolean(), seated: v.boolean() }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "hourBeat", { key: mc.member._id });
    if (!limit.ok) return { open: true, seated: false };
    const now = Date.now();
    const hour = await openHour(ctx, now);
    if (!hour) {
      // The hour is over: any seat the student still has ends at its close.
      const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(3);
      for (const seat of seats) {
        if (seat.leftAt !== undefined) continue;
        const own = await ctx.db.get(seat.hourId);
        if (own) await endSeat(ctx, seat, own, now, null);
      }
      return { open: false, seated: false };
    }
    const seat = await seatOf(ctx, mc.member._id, hour._id);
    if (!seat || !seatIsCurrent(seat, hour, now)) return { open: true, seated: false };
    await ctx.db.patch(seat._id, { lastBeatAt: now });
    return { open: true, seated: true };
  },
});

// Leaves the seat. The minutes are recorded.
export const leave = mutation({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(3);
    for (const seat of seats) {
      if (seat.leftAt !== undefined) continue;
      const hour = await ctx.db.get(seat.hourId);
      if (hour) await endSeat(ctx, seat, hour, now, mc);
    }
    return { ok: true as const };
  },
});

// The seats the student may see, live. Only a seated student sees anyone, and only the students of their own institute. A student in Do not
// disturb sees no one, and a seat in Do not disturb is seen by no one else (the student always sees their own seat).
export const seats = query({
  args: {},
  returns: v.object({
    seated: v.boolean(),
    people: v.array(v.object({ seatId: v.id("seats"), name: v.string(), mode: v.string(), mine: v.boolean() })),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const hour = await openHour(ctx, now);
    if (!hour) return { seated: false, people: [] };
    const mine = await seatOf(ctx, mc.member._id, hour._id);
    if (!mine || !seatIsCurrent(mine, hour, now)) return { seated: false, people: [] };
    const rows = await ctx.db
      .query("seats")
      .withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", hour._id).eq("instituteId", mc.member.instituteId as NonNullable<typeof mc.member.instituteId>))
      .take(300);
    const people = [];
    for (const seat of rows) {
      if (!seatIsCurrent(seat, hour, now)) continue;
      const isMine = seat._id === mine._id;
      if (!isMine && !canSee(mine.mode as Mode, seat.mode as Mode)) continue;
      const who = await ctx.db.get(seat.memberId);
      people.push({ seatId: seat._id, name: who?.name ?? "", mode: seat.mode, mine: isMine });
    }
    return { seated: true, people };
  },
});

// Sends a chat message. The student must have a current seat that is not in Do not disturb. Every message is stored.
export const chat = mutation({
  args: { text: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "hourChat", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    const now = Date.now();
    const hour = await openHour(ctx, now);
    if (!hour) return { ok: false as const, code: "closed" };
    const seat = await seatOf(ctx, mc.member._id, hour._id);
    if (!seat || !seatIsCurrent(seat, hour, now)) return { ok: false as const, code: "not_seated" };
    if (seat.mode === "dnd") return { ok: false as const, code: "dnd" };
    const text = cleanMessage(args.text);
    if (!text) return { ok: false as const, code: "bad_text" };
    await ctx.db.insert("chatMessages", {
      hourId: hour._id,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      authorMemberId: mc.member._id,
      text,
      createdAt: now,
      reported: false,
      status: "shown",
    });
    return { ok: true as const };
  },
});

// The latest messages of the open hour in the student's own institute. A student in Do not disturb, or with no seat, sees none.
export const messages = query({
  args: {},
  returns: v.array(v.object({ messageId: v.id("chatMessages"), text: v.string(), authorName: v.string(), mine: v.boolean(), createdAt: v.number() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const hour = await openHour(ctx, now);
    if (!hour) return [];
    const mine = await seatOf(ctx, mc.member._id, hour._id);
    if (!mine || !seatIsCurrent(mine, hour, now) || mine.mode === "dnd") return [];
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", hour._id).eq("instituteId", mc.member.instituteId as NonNullable<typeof mc.member.instituteId>))
      .order("desc")
      .take(MESSAGES_SHOWN);
    const out = [];
    for (const m of rows.reverse()) {
      if (m.status !== "shown") continue;
      const author = await ctx.db.get(m.authorMemberId);
      out.push({ messageId: m._id, text: m.text, authorName: author?.name ?? "", mine: m.authorMemberId === mc.member._id, createdAt: m.createdAt });
    }
    return out;
  },
});

// A student reports a message of the open hour in their own institute. A teacher and DHI see it marked in their review.
export const report = mutation({
  args: { messageId: v.id("chatMessages") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const message = await ctx.db.get(args.messageId);
    const hour = await openHour(ctx, Date.now());
    if (!message || !hour || message.hourId !== hour._id || message.instituteId !== mc.member.instituteId) fail("not_found");
    if (!message.reported) await ctx.db.patch(message._id, { reported: true });
    return { ok: true as const };
  },
});

// Review, for a teacher (the messages of students of their own classes) or a DHI admin (the reported messages of every institute). Latest first.
export const review = query({
  args: {},
  returns: v.array(
    v.object({ messageId: v.id("chatMessages"), text: v.string(), authorName: v.string(), createdAt: v.number(), reported: v.boolean(), status: v.string() }),
  ),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher" && mc.role !== "dhi_admin") fail("forbidden");
    const out = [];
    if (mc.role === "dhi_admin") {
      const rows = await ctx.db.query("chatMessages").order("desc").take(200);
      for (const m of rows) {
        if (!m.reported) continue;
        const author = await ctx.db.get(m.authorMemberId);
        out.push({ messageId: m._id, text: m.text, authorName: author?.name ?? "", createdAt: m.createdAt, reported: m.reported, status: m.status });
      }
      return out;
    }
    const mine = await teacherClassIds(ctx, mc.member._id);
    const instituteId = mc.member.instituteId as NonNullable<typeof mc.member.instituteId>;
    const rows = await ctx.db.query("chatMessages").order("desc").take(400);
    for (const m of rows) {
      if (m.instituteId !== instituteId) continue;
      const author = await ctx.db.get(m.authorMemberId);
      if (!author?.classId || !mine.includes(author.classId)) continue;
      out.push({ messageId: m._id, text: m.text, authorName: author.name, createdAt: m.createdAt, reported: m.reported, status: m.status });
      if (out.length >= 100) break;
    }
    return out;
  },
});

// A teacher of the author's class, or a DHI admin, hides a message.
export const hideMessage = mutation({
  args: { messageId: v.id("chatMessages") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher" && mc.role !== "dhi_admin") fail("forbidden");
    const message = await ctx.db.get(args.messageId);
    if (!message) fail("not_found");
    if (mc.role === "teacher") {
      if (message.instituteId !== mc.member.instituteId) fail("forbidden");
      const author = await ctx.db.get(message.authorMemberId);
      const mine = await teacherClassIds(ctx, mc.member._id);
      if (!author?.classId || !mine.includes(author.classId)) fail("forbidden");
    }
    await ctx.db.patch(message._id, { status: "hidden" });
    return { ok: true as const };
  },
});

// The scheduled sweep (every minute): drops every seat whose heartbeat stopped for 60 seconds, and every seat of an hour that has closed. It
// writes the presence events as the system.
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db.query("seats").withIndex("by_leftAt", (q) => q.eq("leftAt", undefined)).take(500);
    let ended = 0;
    for (const seat of open) {
      const hour = await ctx.db.get(seat.hourId);
      if (!hour) continue;
      if (!isOpenAt(now, hour) || !seatIsCurrent(seat, hour, now)) {
        await endSeat(ctx, seat, hour, now, null);
        ended += 1;
      }
    }
    return ended;
  },
});
