// The entry check of the house (spec house/0002, "Entry check"). `requireMember` is the one place a house function finds the person: it reads
// the verified session on the server, finds their `members` row by `authUserId` (never by email), refuses a removed member and a member of a
// suspended institute, refuses a student whose consent is missing or withdrawn (spec house/0005), and re-reads a teacher's class assignments on
// every call. No house function takes a member id, an email or an auth user id as the caller's identity.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, requireSignedIn, type SignedInUser } from "./helpers";
import { gateOf } from "./consentState";
import type { ConsentGate } from "./consentRules";
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
  // The consent gate of a student (spec house/0005): always `ok` after `requireMember`, who refuses a locked student. Only the lock tolerant
  // check can return a context whose gate is not `ok`. Everyone but a student is `ok`.
  gate: ConsentGate;
};

export async function memberOfUser(ctx: Reader, authUserId: string): Promise<Doc<"members"> | null> {
  return await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId)).unique();
}

export async function teacherClassIds(ctx: Reader, memberId: Id<"members">): Promise<Id<"classes">[]> {
  const rows = await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(200);
  return rows.map((r) => r.classId);
}

// The one place the signed in person is found. `locked` says what a locked student may still do: a student whose consent is missing or withdrawn
// is refused with `consent_required` or `consent_withdrawn` (withdrawn first) unless `tolerant` is set, and a removed member or one of a
// suspended institute is refused unless `inactive` is set. Consent is read on every call, so a change takes effect on the next one (AC-1).
async function loadMember(ctx: Reader, opts: { tolerant: boolean; inactive: boolean }): Promise<MemberContext> {
  const user = await requireSignedIn(ctx);
  const member = await memberOfUser(ctx, user.authUserId);
  if (!member || member.erasedAt !== undefined) fail("not_a_member");
  if (member.status !== "active" && !opts.inactive) fail("removed");
  const institute = member.instituteId ? await ctx.db.get(member.instituteId) : null;
  if (member.instituteId && !institute) fail("not_a_member");
  if (institute && institute.status === "suspended" && !opts.inactive) fail("institute_suspended");
  // A class whose logins are paused (spec house/0021): its students are refused as if removed, until the class is resumed.
  if (member.role === "student" && member.classId && !opts.inactive && (await ctx.db.get(member.classId))?.pausedAt !== undefined) fail("removed");
  const gate = await gateOf(ctx, member);
  if (!opts.tolerant) {
    if (gate.state === "withdrawn") fail("consent_withdrawn");
    if (gate.state === "consentNeeded") fail("consent_required");
  }
  const classIds = member.role === "teacher" ? await teacherClassIds(ctx, member._id) : member.classId ? [member.classId] : [];
  return { user, member, role: member.role, institute, classIds, gate };
}

export async function requireMember(ctx: Reader): Promise<MemberContext> {
  return await loadMember(ctx, { tolerant: false, inactive: false });
}

// The lock tolerant entry check (spec house/0005, AC-6). Exactly these functions use it: consent.notice, consent.state, consent.agree,
// consent.withdraw, consent.restore, sharing.get, sharing.set, access.mine, dataRights.exportMine and dataRights.eraseMine (members.me reads the
// person itself and answers the consent states without throwing). A
// source scan in houseConsent.test.ts fails if any other function does. It lets a student who is locked still reach their consent and their own
// data, and with `inactive` also a removed student or one of a suspended institute (data rights: consent state, export and erase). It never
// lets anyone into a room: rooms use `requireMember`.
export async function requireMemberAllowLocked(ctx: Reader, opts: { inactive?: boolean } = {}): Promise<MemberContext> {
  return await loadMember(ctx, { tolerant: true, inactive: opts.inactive === true });
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
