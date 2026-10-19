// The house's people (spec house/0002): `me` tells a page which entry state a person is in, `claimInvite` is the Join step, and the rest let
// staff see and manage the members they may. Every function except `me` starts with `requireMember` (houseAuth.ts); a caller never passes
// who they are. Expected refusals of the Join step return `{ ok: false, code }` instead of throwing, so the rate limit count stays (AC-17).
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { env, mutation, query, type QueryCtx } from "./_generated/server";
import { fail, getSignedInUser, requireSignedIn } from "./helpers";
import { logAccess, memberOfUser, requireMember } from "./houseAuth";
import { isExpired, mayClaimUnverified, memberShapeProblem, PAGE_SIZE } from "./houseCore";
import { pendingInviteFor } from "./inviteCore";
import { rateLimiter } from "./limits";
import { roleValidator } from "./schema";

const className = (cls: Doc<"classes"> | null) => (cls ? `${cls.grade} ${cls.section}` : null);

const meValidator = v.union(
  v.object({ state: v.literal("signedOut") }),
  v.object({ state: v.literal("noHouse") }),
  v.object({ state: v.literal("invitePending"), role: roleValidator, instituteName: v.union(v.string(), v.null()) }),
  v.object({
    state: v.literal("active"),
    memberId: v.id("members"),
    role: roleValidator,
    name: v.string(),
    instituteName: v.union(v.string(), v.null()),
    className: v.union(v.string(), v.null()),
  }),
  v.object({ state: v.literal("removed") }),
  v.object({ state: v.literal("suspended"), role: roleValidator, instituteName: v.string() }),
);

// Which entry state this person is in, so the page never has to guess. No email is returned, and nothing is created.
export const me = query({
  args: {},
  returns: meValidator,
  handler: async (ctx) => {
    const user = await getSignedInUser(ctx);
    if (!user) return { state: "signedOut" as const };
    const member = await memberOfUser(ctx, user.authUserId);
    if (member) {
      if (member.status !== "active") return { state: "removed" as const };
      const institute = member.instituteId ? await ctx.db.get(member.instituteId) : null;
      if (institute?.status === "suspended") return { state: "suspended" as const, role: member.role, instituteName: institute.name };
      const cls = member.classId ? await ctx.db.get(member.classId) : null;
      return {
        state: "active" as const,
        memberId: member._id,
        role: member.role,
        name: member.name,
        instituteName: institute?.name ?? null,
        className: className(cls),
      };
    }
    const invite = await pendingInviteFor(ctx, user.email);
    if (!invite) return { state: "noHouse" as const };
    const institute = invite.instituteId ? await ctx.db.get(invite.instituteId) : null;
    return { state: "invitePending" as const, role: invite.role, instituteName: institute?.name ?? null };
  },
});

// The Join step. Only a session whose Google email is verified (or a test inbox on a test sign in deployment, never for a DHI admin or
// counselor invite) can claim the invite that holds that very email, and only by pressing Join: nothing is created before this call.
// Claiming twice, or from two tabs at once, makes one membership. It creates a `members` row and nothing else (AC-5): no `students`,
// `checks` or `consents` row is read for or written.
export const claimInvite = mutation({
  args: {},
  returns: v.union(v.object({ ok: v.literal(true), memberId: v.id("members") }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx) => {
    const user = await requireSignedIn(ctx);
    const limit = await rateLimiter.limit(ctx, "inviteClaim", { key: user.authUserId });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };

    const existing = await memberOfUser(ctx, user.authUserId);
    if (existing) return { ok: true as const, memberId: existing._id };

    const invite = await pendingInviteFor(ctx, user.email);
    if (!invite) return { ok: false as const, code: "no_invite" };
    if (!user.emailVerified && !mayClaimUnverified({ testSignin: env.TEST_SIGNIN_ENABLED === "true", email: user.email, role: invite.role })) {
      return { ok: false as const, code: "email_not_verified" };
    }
    if (isExpired(invite, Date.now())) return { ok: false as const, code: "invite_expired" };

    if (invite.instituteId) {
      const institute = await ctx.db.get(invite.instituteId);
      if (!institute || institute.status === "suspended") return { ok: false as const, code: "institute_suspended" };
    }
    if (invite.role === "student") {
      const cls = invite.classId ? await ctx.db.get(invite.classId) : null;
      if (!cls || cls.archivedAt !== undefined) return { ok: false as const, code: "class_archived" };
    }
    // The invite was checked when it was made; this is the same rule again at the moment it becomes a member.
    if (memberShapeProblem(invite)) return { ok: false as const, code: "no_invite" };

    const now = Date.now();
    const memberId = await ctx.db.insert("members", {
      authUserId: user.authUserId,
      role: invite.role,
      ...(invite.instituteId ? { instituteId: invite.instituteId } : {}),
      ...(invite.classId ? { classId: invite.classId } : {}),
      name: invite.name,
      email: user.email,
      ...(invite.under18 !== undefined ? { under18: invite.under18 } : {}),
      status: "active",
      joinedAt: now,
    });
    await ctx.db.patch(invite._id, { claimedAt: now, claimedBy: memberId });
    await logAccess(ctx, { actor: memberId, action: "invite.claim", instituteId: invite.instituteId, targetMemberId: memberId, inviteId: invite._id });
    return { ok: true as const, memberId };
  },
});

const memberRow = v.object({
  _id: v.id("members"),
  name: v.string(),
  email: v.string(),
  role: roleValidator,
  classId: v.union(v.id("classes"), v.null()),
  className: v.union(v.string(), v.null()),
  under18: v.union(v.boolean(), v.null()),
  status: v.union(v.literal("active"), v.literal("removed")),
});

async function toRow(ctx: QueryCtx, m: Doc<"members">) {
  const cls = m.classId ? await ctx.db.get(m.classId) : null;
  return {
    _id: m._id,
    name: m.name,
    email: m.email,
    role: m.role,
    classId: m.classId ?? null,
    className: className(cls),
    under18: m.under18 ?? null,
    status: m.status,
  };
}

// Members in the caller's scope, 25 a page. A teacher must name one of their own classes (re read on every call) and sees its students. An
// institute admin sees their own institute. A DHI admin may narrow to an institute or a class, or see everyone.
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    classId: v.optional(v.id("classes")),
    instituteId: v.optional(v.id("institutes")),
    role: v.optional(roleValidator),
  },
  returns: paginationResultValidator(memberRow),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };

    if (mc.role === "teacher") {
      if (!args.classId) fail("class_not_in_scope");
      if (!mc.classIds.includes(args.classId)) fail("class_not_in_scope");
      const page = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", args.classId)).paginate(opts);
      return { ...page, page: await Promise.all(page.page.map((m) => toRow(ctx, m))) };
    }
    if (mc.role !== "institute_admin" && mc.role !== "dhi_admin") fail("forbidden");

    let instituteId: Id<"institutes"> | undefined;
    if (mc.role === "institute_admin") {
      instituteId = mc.member.instituteId;
      if (args.instituteId !== undefined && args.instituteId !== instituteId) fail("forbidden");
    } else {
      instituteId = args.instituteId;
    }

    if (args.classId) {
      const cls = await ctx.db.get(args.classId);
      if (!cls || (instituteId !== undefined && cls.instituteId !== instituteId)) fail("class_not_in_scope");
      const page = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", args.classId)).paginate(opts);
      return { ...page, page: await Promise.all(page.page.map((m) => toRow(ctx, m))) };
    }
    if (instituteId !== undefined) {
      const id = instituteId;
      const role = args.role;
      const page = role
        ? await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", id).eq("role", role)).paginate(opts)
        : await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", id)).paginate(opts);
      return { ...page, page: await Promise.all(page.page.map((m) => toRow(ctx, m))) };
    }
    // A DHI admin looking at everyone.
    const all = ctx.db.query("members").order("desc");
    const page = await (args.role ? all.filter((q) => q.eq(q.field("role"), args.role)) : all).paginate(opts);
    return { ...page, page: await Promise.all(page.page.map((m) => toRow(ctx, m))) };
  },
});

// The person a staff member acts on. A DHI admin reaches anyone. An institute admin reaches teachers and students of their own institute
// (and the other admins of it), never a DHI admin or a counselor, and a person of another institute is `not_found` so nothing is learned.
async function targetFor(ctx: QueryCtx, mc: Awaited<ReturnType<typeof requireMember>>, memberId: Id<"members">): Promise<Doc<"members">> {
  if (mc.role !== "dhi_admin" && mc.role !== "institute_admin") fail("forbidden");
  const target = await ctx.db.get(memberId);
  if (!target) fail("not_found");
  if (mc.role === "dhi_admin") return target;
  if (target.role === "dhi_admin" || target.role === "counselor") fail("forbidden");
  if (target.instituteId !== mc.member.instituteId) fail("not_found");
  return target;
}

// The last active DHI admin, and the last active admin of an active institute, cannot be removed (AC-10).
async function isLastAdmin(ctx: QueryCtx, target: Doc<"members">): Promise<boolean> {
  if (target.role === "dhi_admin") {
    const admins = await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", undefined).eq("role", "dhi_admin")).take(200);
    return !admins.some((m) => m._id !== target._id && m.status === "active");
  }
  if (target.role === "institute_admin" && target.instituteId) {
    const institute = await ctx.db.get(target.instituteId);
    if (!institute || institute.status !== "active") return false;
    const id = target.instituteId;
    const admins = await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", id).eq("role", "institute_admin")).take(200);
    return !admins.some((m) => m._id !== target._id && m.status === "active");
  }
  return false;
}

const statusResult = v.object({ status: v.union(v.literal("active"), v.literal("removed")) });

// Removing locks the person out on their next call and leaves every row they own untouched (AC-9). Roles never change.
export const remove = mutation({
  args: { memberId: v.id("members") },
  returns: statusResult,
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const target = await targetFor(ctx, mc, args.memberId);
    if (target.status === "removed") return { status: "removed" as const };
    if (await isLastAdmin(ctx, target)) fail("last_admin");
    await ctx.db.patch(target._id, { status: "removed", removedAt: Date.now() });
    await logAccess(ctx, { actor: mc.member._id, action: "member.remove", instituteId: target.instituteId, targetMemberId: target._id });
    return { status: "removed" as const };
  },
});

export const reinstate = mutation({
  args: { memberId: v.id("members") },
  returns: statusResult,
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const target = await targetFor(ctx, mc, args.memberId);
    if (target.status === "active") return { status: "active" as const };
    await ctx.db.patch(target._id, { status: "active", removedAt: undefined });
    await logAccess(ctx, { actor: mc.member._id, action: "member.reinstate", instituteId: target.instituteId, targetMemberId: target._id });
    return { status: "active" as const };
  },
});

// Move a student to another class of the same institute. Only `classId` changes. A student cannot do this to themselves.
export const setClass = mutation({
  args: { memberId: v.id("members"), classId: v.id("classes") },
  returns: v.object({ classId: v.id("classes") }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const target = await targetFor(ctx, mc, args.memberId);
    if (target.role !== "student") fail("forbidden");
    const cls = await ctx.db.get(args.classId);
    if (!cls || cls.instituteId !== target.instituteId) fail("class_not_in_scope");
    if (cls.archivedAt !== undefined) fail("class_archived");
    await ctx.db.patch(target._id, { classId: cls._id });
    await logAccess(ctx, { actor: mc.member._id, action: "member.class", instituteId: target.instituteId, targetMemberId: target._id });
    return { classId: cls._id };
  },
});

// The under 18 flag comes from the class list only. Only a DHI admin can correct it afterwards, and the correction is logged (AC-11).
export const setUnder18 = mutation({
  args: { memberId: v.id("members"), under18: v.boolean() },
  returns: v.object({ under18: v.boolean() }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "dhi_admin") fail("forbidden");
    const target = await ctx.db.get(args.memberId);
    if (!target) fail("not_found");
    if (target.role !== "student") fail("forbidden");
    await ctx.db.patch(target._id, { under18: args.under18 });
    await logAccess(ctx, { actor: mc.member._id, action: "member.under18", instituteId: target.instituteId, targetMemberId: target._id });
    return { under18: args.under18 };
  },
});
