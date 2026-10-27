// The staff houses (house spec 0026; the owner's choice of 2026-10-27). `todo` is each staff role's first screen: counts of what waits for them,
// never a student's name or room data. `overview` gives a DHI admin counts per institute. `counselors` is the DHI admin's counselor roster: each
// counselor and how many times they have open, never a booking or a student. Every function starts with `requireMember`. Counts are capped
// (`CAP`), and a capped count is shown as "CAP or more".
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { isMinor, parentSideOf } from "./consentState";
import { todayOf } from "./dayRules";
import { fail } from "./helpers";
import { requireDhiAdmin, requireMember } from "./houseAuth";

export const CAP = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_MS = 2 * DAY_MS; // a paper closing within two days
const EXPIRING_MS = 3 * DAY_MS; // an invite ending within three days

const pendingInvite = (i: { claimedAt?: number; revokedAt?: number; expiresAt: number }, now: number) => i.claimedAt === undefined && i.revokedAt === undefined && i.expiresAt > now;

const teacherTodo = v.object({
  role: v.literal("teacher"),
  toMark: v.number(),
  toConfirm: v.number(),
  postsToReview: v.number(),
  commentsToReview: v.number(),
  closingSoon: v.number(),
});
const adminTodo = v.object({
  role: v.literal("institute_admin"),
  parentWaiting: v.number(),
  invitesPending: v.number(),
  invitesExpiring: v.number(),
  classesPaused: v.number(),
});
const dhiTodo = v.object({
  role: v.literal("dhi_admin"),
  filmsWaiting: v.number(),
  dishesWaiting: v.number(),
  deskToday: v.number(),
  institutesPaused: v.number(),
  counselorInvitesPending: v.number(),
});

// A student of these classes who stands in the house: a withdrawn or removed author does not make work for a teacher.
async function activeIn(ctx: QueryCtx, memberId: Id<"members">, classIds: Id<"classes">[]): Promise<boolean> {
  const m = await ctx.db.get(memberId);
  return !!m && m.status === "active" && m.erasedAt === undefined && m.classId !== undefined && classIds.includes(m.classId);
}

// What waits for the signed in staff member. `now` is the screen's clock, used only for "closing soon" and "expiring" (a query does not rerun by
// the clock alone). A student or a counselor gets `null`: their homes are elsewhere.
export const todo = query({
  args: { now: v.number() },
  returns: v.union(teacherTodo, adminTodo, dhiTodo, v.null()),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const now = args.now;

    if (mc.role === "teacher") {
      let toMark = 0;
      let toConfirm = 0;
      let closingSoon = 0;
      const papers = await ctx.db.query("papers").withIndex("by_teacherMemberId", (q) => q.eq("teacherMemberId", mc.member._id)).take(200);
      for (const paper of papers) {
        if (paper.status !== "sent") continue;
        for (const a of await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", paper._id)).take(CAP)) {
          if (a.missed === true || a.excused === true) continue;
          if (a.status === "submitted") toMark += 1;
          else if (a.status === "marked") toConfirm += 1;
        }
        for (const s of await ctx.db.query("paperSends").withIndex("by_paperId", (q) => q.eq("paperId", paper._id)).take(50)) {
          if (s.dueAt > now && s.dueAt <= now + SOON_MS) closingSoon += 1;
        }
      }
      let postsToReview = 0;
      let commentsToReview = 0;
      const instituteId = mc.member.instituteId;
      if (instituteId !== undefined && mc.classIds.length > 0) {
        for (const p of await ctx.db.query("blogPosts").withIndex("by_instituteId_and_status", (q) => q.eq("instituteId", instituteId).eq("status", "pending")).take(200)) {
          if (await activeIn(ctx, p.authorMemberId, mc.classIds)) postsToReview += 1;
        }
        for (const c of await ctx.db.query("blogComments").withIndex("by_instituteId_and_status", (q) => q.eq("instituteId", instituteId).eq("status", "pending")).take(200)) {
          if (await activeIn(ctx, c.authorMemberId, mc.classIds)) commentsToReview += 1;
        }
      }
      return { role: "teacher" as const, toMark, toConfirm, postsToReview, commentsToReview, closingSoon };
    }

    if (mc.role === "institute_admin") {
      const instituteId = mc.member.instituteId;
      if (instituteId === undefined) fail("forbidden");
      let parentWaiting = 0;
      for (const m of await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", instituteId).eq("role", "student")).take(CAP)) {
        if (m.status !== "active" || m.erasedAt !== undefined || !isMinor(m.under18)) continue;
        if ((await parentSideOf(ctx, m)) === "needed") parentWaiting += 1;
      }
      const invites = (await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).order("desc").take(CAP)).filter((i) => pendingInvite(i, now));
      const classes = await ctx.db.query("classes").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).take(CAP);
      return {
        role: "institute_admin" as const,
        parentWaiting,
        invitesPending: invites.length,
        invitesExpiring: invites.filter((i) => i.expiresAt <= now + EXPIRING_MS).length,
        classesPaused: classes.filter((c) => c.pausedAt !== undefined && c.archivedAt === undefined).length,
      };
    }

    if (mc.role === "dhi_admin") {
      const films = await ctx.db.query("films").withIndex("by_status", (q) => q.eq("status", "pending")).take(CAP);
      const dishes = await ctx.db.query("foods").withIndex("by_status", (q) => q.eq("status", "custom")).take(CAP);
      const daily = await ctx.db.query("deskDaily").withIndex("by_day", (q) => q.eq("day", todayOf(now))).first();
      const institutes = await ctx.db.query("institutes").take(CAP);
      const invites = await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", undefined)).order("desc").take(CAP);
      return {
        role: "dhi_admin" as const,
        filmsWaiting: films.length,
        dishesWaiting: dishes.length,
        deskToday: daily?.questions ?? 0,
        institutesPaused: institutes.filter((i) => i.status === "suspended").length,
        counselorInvitesPending: invites.filter((i) => i.role === "counselor" && pendingInvite(i, now)).length,
      };
    }
    return null;
  },
});

// A DHI admin's view of every institute: counts only, never a name. `month` is "YYYY-MM" (India): papers sent and desk questions asked in it.
export const overview = query({
  args: { now: v.number() },
  returns: v.array(
    v.object({
      instituteId: v.id("institutes"),
      name: v.string(),
      status: v.string(),
      classes: v.number(),
      students: v.number(),
      staff: v.number(),
      invitesPending: v.number(),
      papersThisMonth: v.number(),
      deskThisMonth: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireDhiAdmin(ctx);
    const now = args.now;
    const month = todayOf(now).slice(0, 7);
    const monthStart = Date.parse(`${month}-01T04:00:00+05:30`);
    const out = [];
    for (const inst of await ctx.db.query("institutes").take(200)) {
      const id = inst._id;
      const count = async (role: "student" | "teacher" | "institute_admin") =>
        (await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", id).eq("role", role)).take(CAP)).filter((m) => m.status === "active" && m.erasedAt === undefined).length;
      const classes = (await ctx.db.query("classes").withIndex("by_instituteId", (q) => q.eq("instituteId", id)).take(CAP)).filter((c) => c.archivedAt === undefined).length;
      const invites = (await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", id)).order("desc").take(CAP)).filter((i) => pendingInvite(i, now)).length;
      const papers = (await ctx.db.query("paperSends").withIndex("by_instituteId_and_sentAt", (q) => q.eq("instituteId", id).gte("sentAt", monthStart)).take(CAP)).length;
      const desk = (await ctx.db.query("deskTurns").withIndex("by_instituteId_and_createdAt", (q) => q.eq("instituteId", id).gte("createdAt", monthStart)).take(CAP)).length;
      out.push({
        instituteId: id,
        name: inst.name,
        status: inst.status,
        classes,
        students: await count("student"),
        staff: (await count("teacher")) + (await count("institute_admin")),
        invitesPending: invites,
        papersThisMonth: papers,
        deskThisMonth: desk,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// The DHI admin's counselor roster: every counselor (name, email, active or paused, how many times they have open from now) and the counselor
// invites still waiting. Never a booking, a note or a student.
export const counselors = query({
  args: { now: v.number() },
  returns: v.object({
    counselors: v.array(v.object({ memberId: v.id("members"), name: v.string(), email: v.string(), status: v.string(), openTimes: v.number() })),
    invites: v.array(v.object({ inviteId: v.id("invites"), name: v.string(), email: v.string(), expiresAt: v.number() })),
  }),
  handler: async (ctx, args) => {
    await requireDhiAdmin(ctx);
    const counselors = [];
    for (const m of await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", undefined).eq("role", "counselor")).take(200)) {
      if (m.erasedAt !== undefined) continue;
      const slots = await ctx.db
        .query("counselSlots")
        .withIndex("by_counselorMemberId_and_startsAt", (q) => q.eq("counselorMemberId", m._id).gte("startsAt", args.now))
        .take(CAP);
      counselors.push({ memberId: m._id, name: m.name, email: m.email, status: m.status, openTimes: slots.filter((s) => s.status === "open").length });
    }
    const invites = (await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", undefined)).order("desc").take(CAP))
      .filter((i) => i.role === "counselor" && pendingInvite(i, args.now))
      .map((i) => ({ inviteId: i._id, name: i.name, email: i.email, expiresAt: i.expiresAt }));
    return { counselors: counselors.sort((a, b) => a.name.localeCompare(b.name)), invites };
  },
});
