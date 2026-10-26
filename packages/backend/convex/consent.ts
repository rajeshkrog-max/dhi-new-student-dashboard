// The house consent (spec house/0005). A student agrees to the house notice for themselves, and for a student under 18 the school's institute
// admin records that a parent's consent is on file. Either side can withdraw, and a withdrawal pauses every room on the next call (the gate in
// houseAuth.ts reads the records on every call). Records are append only. Expected refusals of the functions that count against a limit return
// `{ ok: false, code }` instead of throwing, so the count stays (AC-17).
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { isMinor } from "./consentRules";
import { ensureConsentText, parentSideOf, sideWithdrawn } from "./consentState";
import {
  CONSENT_TEXTS,
  HOUSE_NOTICE_LINES,
  HOUSE_NOTICE_VERSION,
  HOUSE_PARENT_ACCEPTED_VERSIONS,
  HOUSE_PARENT_LINES,
  HOUSE_PARENT_VERSION,
  HOUSE_WORDS_APPROVED,
  consentHash,
} from "./consentText";
import { fail } from "./helpers";
import { logAccess, requireMember, requireMemberAllowLocked, type MemberContext } from "./houseAuth";
import { dropLinks } from "./parentLinkCore";
import { PAGE_SIZE } from "./houseCore";
import { rateLimiter } from "./limits";

export const PARENT_BATCH_MAX = 50;

const refusal = v.object({ ok: v.literal(false), code: v.string() });
const okOnly = v.object({ ok: v.literal(true) });
const okOrRefused = v.union(okOnly, refusal);

const gateValidator = v.union(
  v.object({ state: v.literal("ok") }),
  v.object({ state: v.literal("consentNeeded"), missing: v.array(v.union(v.literal("self"), v.literal("parent"))) }),
  v.object({ state: v.literal("withdrawn"), by: v.array(v.union(v.literal("self"), v.literal("school"))) }),
);

async function requireStudentAllowLocked(ctx: Parameters<typeof requireMemberAllowLocked>[0], opts: { inactive?: boolean } = {}): Promise<MemberContext> {
  const mc = await requireMemberAllowLocked(ctx, opts);
  if (mc.role !== "student") fail("forbidden");
  return mc;
}

// The current house notice: its version, its exact lines, its fingerprint, and whether the owner has approved the words yet. The screen draws the
// lines as written and sends the version and fingerprint back with the agreement.
export const notice = query({
  args: {},
  returns: v.object({ version: v.string(), lines: v.array(v.string()), hash: v.string(), approved: v.boolean() }),
  handler: async (ctx) => {
    await requireStudentAllowLocked(ctx);
    return {
      version: HOUSE_NOTICE_VERSION,
      lines: [...HOUSE_NOTICE_LINES],
      hash: await consentHash(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]),
      approved: HOUSE_WORDS_APPROVED,
    };
  },
});

// Where the student stands: what is missing, or who withdrew. A removed student or one of a suspended institute can still read this (data rights).
export const state = query({
  args: {},
  returns: v.object({ gate: gateValidator, under18: v.boolean() }),
  handler: async (ctx) => {
    const mc = await requireStudentAllowLocked(ctx, { inactive: true });
    return { gate: mc.gate, under18: isMinor(mc.member.under18) };
  },
});

// The student presses I agree. Only the current version with its exact fingerprint counts; an unknown version or a wrong fingerprint answers
// `consent_text_changed` (the screen then reloads the notice). A repeat for the same version changes nothing.
export const agree = mutation({
  args: { version: v.string(), hash: v.string() },
  returns: okOrRefused,
  handler: async (ctx, args) => {
    const mc = await requireStudentAllowLocked(ctx);
    const limit = await rateLimiter.limit(ctx, "consentAgree", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (args.version !== HOUSE_NOTICE_VERSION) return { ok: false as const, code: "consent_text_changed" };
    const hash = await ensureConsentText(ctx, HOUSE_NOTICE_VERSION, "house");
    if (args.hash !== hash) return { ok: false as const, code: "consent_text_changed" };

    const already = await ctx.db
      .query("consentRecords")
      .withIndex("by_memberId_and_kind", (q) => q.eq("memberId", mc.member._id).eq("kind", "self"))
      .order("desc")
      .take(10);
    if (already.some((r) => r.textVersion === HOUSE_NOTICE_VERSION)) return { ok: true as const };
    await ctx.db.insert("consentRecords", {
      memberId: mc.member._id,
      instituteId: mc.member.instituteId,
      kind: "self",
      by: "self",
      byMemberId: mc.member._id,
      textVersion: HOUSE_NOTICE_VERSION,
      under18AtTime: isMinor(mc.member.under18),
    });
    return { ok: true as const };
  },
});

async function recordSide(ctx: MutationCtx, member: Doc<"members">, side: "self" | "school", kind: "withdrawn" | "restored", by: Id<"members">): Promise<void> {
  await ctx.db.insert("consentRecords", {
    memberId: member._id,
    instituteId: member.instituteId,
    kind,
    by: side,
    byMemberId: by,
    textVersion: side === "self" ? HOUSE_NOTICE_VERSION : HOUSE_PARENT_VERSION,
    under18AtTime: isMinor(member.under18),
  });
  // A withdrawal by either side ends the parent link for good, so agreeing again never brings an old link back (spec house/0022 AC-5; review of
  // 2026-10-26). The student makes a new one if they want to.
  if (kind === "withdrawn") await dropLinks(ctx, member);
}

// The student withdraws their own consent. From the next call every room refuses with `consent_withdrawn`, and the data is kept until they
// erase it. Withdrawing twice records once.
export const withdraw = mutation({
  args: {},
  returns: okOrRefused,
  handler: async (ctx) => {
    const mc = await requireStudentAllowLocked(ctx);
    const limit = await rateLimiter.limit(ctx, "consentWithdraw", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (!(await sideWithdrawn(ctx, mc.member, "self"))) await recordSide(ctx, mc.member, "self", "withdrawn", mc.member._id);
    return { ok: true as const };
  },
});

// The student restores only their own side. If the school is the one who withdrew, a student cannot undo it (`not_withdrawn_by_you`).
export const restore = mutation({
  args: {},
  returns: okOrRefused,
  handler: async (ctx) => {
    const mc = await requireStudentAllowLocked(ctx);
    const limit = await rateLimiter.limit(ctx, "consentWithdraw", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (!(await sideWithdrawn(ctx, mc.member, "self"))) return { ok: false as const, code: "not_withdrawn_by_you" };
    await recordSide(ctx, mc.member, "self", "restored", mc.member._id);
    return { ok: true as const };
  },
});

// ---- The school's side (institute admin only) ----

async function requireSchoolAdmin(ctx: Parameters<typeof requireMember>[0]): Promise<MemberContext> {
  const mc = await requireMember(ctx);
  if (mc.role !== "institute_admin" || !mc.member.instituteId) fail("forbidden");
  return mc;
}

// The words the school relies on when it records a parent's consent, for the school's screen.
export const parentNotice = query({
  args: {},
  returns: v.object({ version: v.string(), lines: v.array(v.string()), approved: v.boolean() }),
  handler: async (ctx) => {
    await requireSchoolAdmin(ctx);
    return { version: HOUSE_PARENT_VERSION, lines: [...HOUSE_PARENT_LINES], approved: HOUSE_WORDS_APPROVED };
  },
});

const parentStatus = v.union(v.literal("needed"), v.literal("onFile"), v.literal("schoolWithdrew"));
const parentRow = v.object({
  memberId: v.id("members"),
  name: v.string(),
  className: v.union(v.string(), v.null()),
  status: parentStatus,
});

// The under 18 students of the institute and where the school's record stands, 25 a page. It shows only the school's own side of a withdrawal,
// never the student's own (AC-20). Erased and removed members are left out. This is the roster, not a view of anyone's data.
export const parentList = query({
  args: { paginationOpts: paginationOptsValidator, classId: v.optional(v.id("classes")), status: v.optional(parentStatus) },
  returns: paginationResultValidator(parentRow),
  handler: async (ctx, args) => {
    const mc = await requireSchoolAdmin(ctx);
    const instituteId = mc.member.instituteId as Id<"institutes">;
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };
    let page;
    if (args.classId) {
      const cls = await ctx.db.get(args.classId);
      if (!cls || cls.instituteId !== instituteId) fail("class_not_in_scope");
      const classId = args.classId;
      page = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", classId)).paginate(opts);
    } else {
      page = await ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", instituteId).eq("role", "student")).paginate(opts);
    }
    const rows = [];
    for (const m of page.page) {
      if (m.role !== "student" || m.instituteId !== instituteId || !isMinor(m.under18) || m.status !== "active" || m.erasedAt !== undefined) continue;
      const status = await parentSideOf(ctx, m);
      if (args.status && args.status !== status) continue;
      const cls = m.classId ? await ctx.db.get(m.classId) : null;
      rows.push({ memberId: m._id, name: m.name, className: cls ? `${cls.grade} ${cls.section}` : null, status });
    }
    return { ...page, page: rows };
  },
});

type Skip = "adult" | "other_institute" | "already_on_file" | "removed";
const skipReason = v.union(v.literal("adult"), v.literal("other_institute"), v.literal("already_on_file"), v.literal("removed"));
const recordResult = v.union(
  v.object({
    ok: v.literal(true),
    recorded: v.number(),
    skipped: v.array(v.object({ memberId: v.id("members"), reason: skipReason })),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  refusal,
);

// One student, for the school: the same checks as the list, as the reason the student cannot be recorded.
async function parentStudent(ctx: MutationCtx, mc: MemberContext, memberId: Id<"members">): Promise<{ target: Doc<"members"> } | { skip: Skip }> {
  const target = await ctx.db.get(memberId);
  // Another institute's student, and a person who does not exist, answer the same, so nothing is learned about either.
  if (!target || target.role !== "student" || target.instituteId !== mc.member.instituteId) return { skip: "other_institute" };
  if (target.status !== "active" || target.erasedAt !== undefined) return { skip: "removed" };
  if (!isMinor(target.under18)) return { skip: "adult" };
  return { target };
}

async function recordOne(ctx: MutationCtx, mc: MemberContext, target: Doc<"members">): Promise<"recorded" | "already_on_file"> {
  const onFile = await ctx.db
    .query("consentRecords")
    .withIndex("by_memberId_and_kind", (q) => q.eq("memberId", target._id).eq("kind", "parent"))
    .order("desc")
    .take(10);
  if (onFile.some((r) => HOUSE_PARENT_ACCEPTED_VERSIONS.includes(r.textVersion))) return "already_on_file";
  await ensureConsentText(ctx, HOUSE_PARENT_VERSION, "house_parent");
  await ctx.db.insert("consentRecords", {
    memberId: target._id,
    instituteId: target.instituteId,
    kind: "parent",
    by: "school",
    byMemberId: mc.member._id,
    textVersion: HOUSE_PARENT_VERSION,
    under18AtTime: true,
  });
  await logAccess(ctx, { actor: mc.member._id, action: "consent.parent", instituteId: target.instituteId, targetMemberId: target._id });
  return "recorded";
}

// The school says a parent's consent is on file, for one student, a short list of students (up to 50), or a class (50 at a time: send back
// `continueCursor` until `isDone`). Only an institute admin of the student's own institute, only for a student marked under 18. A DHI admin cannot.
// It stores who, when and the wording version, and writes one access log row per student. One student that cannot be recorded answers its error
// (`not_found` or `not_under18`); a list or a class answers a skip reason for each student that was not recorded.
export const recordParent = mutation({
  args: { memberIds: v.optional(v.array(v.id("members"))), classId: v.optional(v.id("classes")), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: recordResult,
  handler: async (ctx, args) => {
    const mc = await requireSchoolAdmin(ctx);
    const limit = await rateLimiter.limit(ctx, "parentRecord", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if ((args.memberIds === undefined) === (args.classId === undefined)) return { ok: false as const, code: "bad_request" };

    const skipped: { memberId: Id<"members">; reason: Skip }[] = [];
    let recorded = 0;

    if (args.memberIds) {
      if (args.memberIds.length === 0) return { ok: false as const, code: "bad_request" };
      if (args.memberIds.length > PARENT_BATCH_MAX) return { ok: false as const, code: "too_many" };
      const ids = [...new Set(args.memberIds)];
      for (const id of ids) {
        const r = await parentStudent(ctx, mc, id);
        if ("skip" in r) {
          // A single student answers the reason as an error; in a list it is a skip.
          if (ids.length === 1) return { ok: false as const, code: r.skip === "adult" ? "not_under18" : "not_found" };
          skipped.push({ memberId: id, reason: r.skip });
          continue;
        }
        if ((await recordOne(ctx, mc, r.target)) === "recorded") recorded += 1;
        else skipped.push({ memberId: id, reason: "already_on_file" });
      }
      return { ok: true as const, recorded, skipped, isDone: true, continueCursor: "" };
    }

    const classId = args.classId as Id<"classes">;
    const cls = await ctx.db.get(classId);
    if (!cls || cls.instituteId !== mc.member.instituteId) return { ok: false as const, code: "not_found" };
    const page = await ctx.db
      .query("members")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .paginate({ numItems: PARENT_BATCH_MAX, cursor: args.cursor ?? null });
    for (const m of page.page) {
      const r = await parentStudent(ctx, mc, m._id);
      if ("skip" in r) {
        skipped.push({ memberId: m._id, reason: r.skip });
        continue;
      }
      if ((await recordOne(ctx, mc, r.target)) === "recorded") recorded += 1;
      else skipped.push({ memberId: m._id, reason: "already_on_file" });
    }
    return { ok: true as const, recorded, skipped, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

// The school records that a parent withdrew consent, or that they restored it. Each side's state is the latest of its two records, in creation
// order. Only the school restores its own side. A withdrawal binds only while the student is marked under 18 (decideGate).
async function schoolSide(ctx: MutationCtx, kind: "withdrawn" | "restored", memberId: Id<"members">) {
  const mc = await requireSchoolAdmin(ctx);
  const limit = await rateLimiter.limit(ctx, "parentRecord", { key: mc.member._id });
  if (!limit.ok) return { ok: false as const, code: "rate_limited" };
  const r = await parentStudent(ctx, mc, memberId);
  if ("skip" in r) return { ok: false as const, code: r.skip === "adult" ? "not_under18" : "not_found" };
  const nowWithdrawn = await sideWithdrawn(ctx, r.target, "school");
  if (kind === "withdrawn" && !nowWithdrawn) {
    await recordSide(ctx, r.target, "school", "withdrawn", mc.member._id);
    await logAccess(ctx, { actor: mc.member._id, action: "consent.parentWithdrawn", instituteId: r.target.instituteId, targetMemberId: r.target._id });
  }
  if (kind === "restored" && nowWithdrawn) {
    await recordSide(ctx, r.target, "school", "restored", mc.member._id);
    await logAccess(ctx, { actor: mc.member._id, action: "consent.parentRestored", instituteId: r.target.instituteId, targetMemberId: r.target._id });
  }
  return { ok: true as const };
}

export const recordParentWithdrawn = mutation({
  args: { memberId: v.id("members") },
  returns: okOrRefused,
  handler: async (ctx, args) => await schoolSide(ctx, "withdrawn", args.memberId),
});

export const recordParentRestored = mutation({
  args: { memberId: v.id("members") },
  returns: okOrRefused,
  handler: async (ctx, args) => await schoolSide(ctx, "restored", args.memberId),
});

