// The database steps shared by every way an invite is made: a single invite, a class list, the owner's first DHI admin and the demo seed
// (spec house/0002). The pure rules live in houseCore.ts.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { emailBlocked } from "./eraseCore";
import { fail } from "./helpers";
import { logAccess, type MemberContext } from "./houseAuth";
import { INVITE_MS, canInviteRole, memberShapeProblem, belongsToInstitute, type Role } from "./houseCore";

type Reader = QueryCtx | MutationCtx;

// The one pending invite for an address (not claimed and not revoked, expired or not), or null. There is never more than one.
export async function pendingInviteFor(ctx: Reader, email: string): Promise<Doc<"invites"> | null> {
  // Not claimed and not revoked are both in the index range, so any number of revoked invites for the address cannot hide the pending one.
  return await ctx.db
    .query("invites")
    .withIndex("by_email_and_claimedAt_and_revokedAt", (q) => q.eq("email", email).eq("claimedAt", undefined).eq("revokedAt", undefined))
    .first();
}

// An address cannot be invited when a person with it is already a member (removed or not: a removed member is reinstated, never re invited)
// or when it already has a pending invite. Every caller shows the same neutral refusal (AC-19), so this says nothing about which.
export async function emailTaken(ctx: Reader, email: string): Promise<boolean> {
  const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", email)).first();
  if (member) return true;
  // An address inside the 30 day block after a student's own erase gets the same neutral refusal (spec house/0005, AC-13).
  if (await emailBlocked(ctx, email)) return true;
  return (await pendingInviteFor(ctx, email)) !== null;
}

// The key of the daily email_in_use cap: the institute, or for a DHI admin with no institute the person's own id.
export const inUseKey = (mc: MemberContext, instituteId: Id<"institutes"> | undefined) => String(instituteId ?? mc.member._id);

export type InviteInput = { role: Role; instituteId?: Id<"institutes">; classId?: Id<"classes">; under18?: boolean };
export type Draft = { role: Role; instituteId?: Id<"institutes">; classId?: Id<"classes">; under18?: boolean };
export type Plan = { ok: true; draft: Draft } | { ok: false; code: "institute_not_found" | "institute_suspended" | "class_not_found" | "class_archived" | "class_not_in_scope" | "under18_missing" };

// What an invite by this caller becomes, or the reason it cannot. Throws `forbidden` when the caller may not invite that role at all, or
// reaches for another institute: that is not an expected refusal, so it does not use a result object (and uses no rate limit token).
export async function planInvite(ctx: Reader, mc: MemberContext, input: InviteInput): Promise<Plan> {
  if (!canInviteRole(mc.role, input.role)) fail("forbidden");
  

  let instituteId: Id<"institutes"> | undefined;
  if (mc.role === "dhi_admin") {
    if (belongsToInstitute(input.role)) {
      if (!input.instituteId) return { ok: false, code: "institute_not_found" };
      const institute = await ctx.db.get(input.instituteId);
      if (!institute) return { ok: false, code: "institute_not_found" };
      if (institute.status === "suspended") return { ok: false, code: "institute_suspended" };
      instituteId = institute._id;
    }
  } else {
    instituteId = mc.member.instituteId;
    if (input.instituteId !== undefined && input.instituteId !== instituteId) fail("forbidden");
  }

  let classId: Id<"classes"> | undefined;
  let under18: boolean | undefined;
  if (input.role === "student") {
    if (!input.classId) return { ok: false, code: "class_not_found" };
    const cls = await ctx.db.get(input.classId);
    if (!cls || cls.instituteId !== instituteId) return { ok: false, code: "class_not_found" };
    if (cls.archivedAt !== undefined) return { ok: false, code: "class_archived" };
    if (mc.role === "teacher" && !mc.classIds.includes(cls._id)) return { ok: false, code: "class_not_in_scope" };
    if (typeof input.under18 !== "boolean") return { ok: false, code: "under18_missing" };
    classId = cls._id;
    under18 = input.under18;
  }

  const draft: Draft = { role: input.role, instituteId, classId, under18 };
  if (memberShapeProblem(draft)) fail("forbidden");
  return { ok: true, draft };
}

export async function insertInvite(
  ctx: MutationCtx,
  v: { draft: Draft; email: string; name: string; createdBy: Id<"members"> | "owner" },
): Promise<Id<"invites">> {
  const { draft } = v;
  const inviteId = await ctx.db.insert("invites", {
    role: draft.role,
    ...(draft.instituteId ? { instituteId: draft.instituteId } : {}),
    email: v.email,
    name: v.name,
    ...(draft.classId ? { classId: draft.classId } : {}),
    ...(draft.under18 !== undefined ? { under18: draft.under18 } : {}),
    createdBy: v.createdBy,
    expiresAt: Date.now() + INVITE_MS,
  });
  await logAccess(ctx, { actor: v.createdBy, action: "invite.create", instituteId: draft.instituteId, inviteId });
  return inviteId;
}

// Whether this caller could create this invite right now ("anyone who could create that invite now, and a DHI admin for any invite").
export async function canManageInvite(ctx: Reader, mc: MemberContext, invite: Doc<"invites">): Promise<boolean> {
  if (mc.role === "dhi_admin") return true;
  if (!canInviteRole(mc.role, invite.role)) return false;
  if (invite.instituteId === undefined || invite.instituteId !== mc.member.instituteId) return false;
  if (mc.role === "teacher") return invite.classId !== undefined && mc.classIds.includes(invite.classId);
  return true;
}
