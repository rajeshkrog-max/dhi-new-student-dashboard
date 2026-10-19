// The entry check of the house (spec house/0002, "Entry check"). `requireMember` is the one place a house function finds the person: it reads
// the verified session on the server, finds their `members` row by `authUserId` (never by email), refuses a removed member and a member of a
// suspended institute, and re-reads a teacher's class assignments on every call. No house function takes a member id, an email or an auth user
// id as the caller's identity. Row 4 (consent) adds one more reason to refuse here, through the same function.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, requireSignedIn, type SignedInUser } from "./helpers";
import { isStaffRole, type AccessCode, type Role } from "./houseCore";

type Reader = QueryCtx | MutationCtx;

export type MemberContext = {
  user: SignedInUser;
  member: Doc<"members">;
  role: Role;
  institute: Doc<"institutes"> | null;
  // The classes this person may act on right now: a teacher's current assignments, a student's own class, nothing for anyone else. Institute
  // admins and DHI admins are scoped by institute, not by class.
  classIds: Id<"classes">[];
};

export async function memberOfUser(ctx: Reader, authUserId: string): Promise<Doc<"members"> | null> {
  return await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId)).unique();
}

export async function teacherClassIds(ctx: Reader, memberId: Id<"members">): Promise<Id<"classes">[]> {
  const rows = await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(200);
  return rows.map((r) => r.classId);
}

export async function requireMember(ctx: Reader): Promise<MemberContext> {
  const user = await requireSignedIn(ctx);
  const member = await memberOfUser(ctx, user.authUserId);
  if (!member) fail("not_a_member");
  if (member.status !== "active") fail("removed");
  const institute = member.instituteId ? await ctx.db.get(member.instituteId) : null;
  if (member.instituteId && !institute) fail("not_a_member");
  if (institute && institute.status === "suspended") fail("institute_suspended");
  const classIds = member.role === "teacher" ? await teacherClassIds(ctx, member._id) : member.classId ? [member.classId] : [];
  return { user, member, role: member.role, institute, classIds };
}

// A staff screen or function: a teacher, an institute admin or a DHI admin.
export async function requireStaff(ctx: Reader): Promise<MemberContext> {
  const mc = await requireMember(ctx);
  if (!isStaffRole(mc.role)) fail("forbidden");
  return mc;
}

export async function requireDhiAdmin(ctx: Reader): Promise<MemberContext> {
  const mc = await requireMember(ctx);
  if (mc.role !== "dhi_admin") fail("forbidden");
  return mc;
}

// One row of the access log (AC-12): the time, the actor, a code from the fixed list and ids. Never a name, an email or a note.
export async function logAccess(
  ctx: MutationCtx,
  entry: {
    actor: Id<"members"> | "owner";
    action: AccessCode;
    instituteId?: Id<"institutes">;
    targetMemberId?: Id<"members">;
    inviteId?: Id<"invites">;
  },
): Promise<void> {
  await ctx.db.insert("accessLog", { at: Date.now(), ...entry });
}
