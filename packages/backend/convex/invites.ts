// Invites (spec house/0002). An invite is a Google email, a role and where the person goes: there is no secret code, and joining is the
// person's own tap (members.claimInvite). Every function starts with `requireMember`. The functions that count refusals against a limit
// (a refused `email_in_use`, a class list) return `{ ok: false, code }` for every expected refusal instead of throwing, so the count stays
// (AC-17, AC-19); they throw only when the caller may not do this at all (`forbidden`) or is not signed in.
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { cleanName, fail } from "./helpers";
import { logAccess, requireMember, type MemberContext } from "./houseAuth";
import {
  BATCH_MAX,
  INVITE_MS,
  PAGE_SIZE,
  checkRowShape,
  normaliseEmail,
  parseClassLabel,
  sectionKey,
  type BadRow,
} from "./houseCore";
import { canManageInvite, emailTaken, inUseKey, insertInvite, planInvite } from "./inviteCore";
import { rateLimiter } from "./limits";
import { roleValidator } from "./schema";

const refusal = v.object({ ok: v.literal(false), code: v.string() });
const createResult = v.union(v.object({ ok: v.literal(true), inviteId: v.id("invites") }), refusal);

// Taken when an address turns out to be in use, and checked before any invite call: after 50 refusals a day an institute's invite calls
// answer `rate_limited` until the next day, and the words never say whether the address is a member or invited (AC-19).
async function inUseExhausted(ctx: MutationCtx, key: string): Promise<boolean> {
  return !(await rateLimiter.check(ctx, "emailInUse", { key })).ok;
}
async function countInUse(ctx: MutationCtx, key: string, count = 1): Promise<void> {
  await rateLimiter.limit(ctx, "emailInUse", { key, count, throws: false });
}

export const create = mutation({
  args: {
    role: roleValidator,
    email: v.string(),
    name: v.string(),
    classId: v.optional(v.id("classes")),
    under18: v.optional(v.boolean()),
    instituteId: v.optional(v.id("institutes")),
  },
  returns: createResult,
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const plan = await planInvite(ctx, mc, { role: args.role, instituteId: args.instituteId, classId: args.classId, under18: args.under18 });
    const key = inUseKey(mc, plan.ok ? plan.draft.instituteId : mc.member.instituteId);
    if (await inUseExhausted(ctx, key)) return { ok: false as const, code: "rate_limited" };
    if (!plan.ok) return { ok: false as const, code: plan.code };

    const name = cleanName(args.name);
    if (!name) return { ok: false as const, code: "bad_name" };
    const email = normaliseEmail(args.email);
    if (!email) return { ok: false as const, code: "bad_email" };
    if (await emailTaken(ctx, email)) {
      await countInUse(ctx, key);
      return { ok: false as const, code: "email_in_use" };
    }
    const inviteId = await insertInvite(ctx, { draft: plan.draft, email, name, createdBy: mc.member._id });
    return { ok: true as const, inviteId };
  },
});

const batchRow = v.object({ name: v.string(), email: v.string(), class: v.string(), under18: v.optional(v.union(v.boolean(), v.null())) });
const batchResult = v.union(
  v.object({ ok: v.literal(true), count: v.number() }),
  v.object({ ok: v.literal(false), code: v.string(), badRows: v.optional(v.array(v.object({ row: v.number(), reason: v.string() }))) }),
);

// A class list, checked as a whole (AC-4): if every row is valid, every invite is created; if any row is bad, none are and the result lists
// each bad row with one fixed reason. Rows are students. The class column is matched to an existing class of the caller's scope by grade and
// section; classes are never created here. The limit of 10 lists an hour is taken first, so a refused list still counts.
export const createBatch = mutation({
  args: { rows: v.array(batchRow), instituteId: v.optional(v.id("institutes")) },
  returns: batchResult,
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "dhi_admin" && mc.role !== "institute_admin" && mc.role !== "teacher") fail("forbidden");

    const limit = await rateLimiter.limit(ctx, "inviteBatch", { key: mc.user.authUserId });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (args.rows.length === 0) return { ok: false as const, code: "empty" };
    if (args.rows.length > BATCH_MAX) return { ok: false as const, code: "too_many_rows" };

    // The institute whose classes the rows name. Checked once here, so a teacher or institute admin cannot name another.
    let instituteId: Id<"institutes"> | undefined;
    if (mc.role === "dhi_admin") {
      if (!args.instituteId) return { ok: false as const, code: "institute_not_found" };
      const institute = await ctx.db.get(args.instituteId);
      if (!institute) return { ok: false as const, code: "institute_not_found" };
      if (institute.status === "suspended") return { ok: false as const, code: "institute_suspended" };
      instituteId = institute._id;
    } else {
      instituteId = mc.member.instituteId;
      if (args.instituteId !== undefined && args.instituteId !== instituteId) fail("forbidden");
    }
    if (!instituteId) fail("forbidden");
    const scopeId = instituteId;
    const key = inUseKey(mc, scopeId);
    if (await inUseExhausted(ctx, key)) return { ok: false as const, code: "rate_limited" };

    const classes = await ctx.db.query("classes").withIndex("by_instituteId", (q) => q.eq("instituteId", scopeId)).take(500);
    const byLabel = new Map<string, Doc<"classes">>();
    for (const c of classes) if (c.archivedAt === undefined) byLabel.set(`${c.grade}|${sectionKey(c.section)}`, c);

    const bad: BadRow[] = [];
    const good: { name: string; email: string; under18: boolean; classId: Id<"classes"> }[] = [];
    const seen = new Set<string>();
    let inUse = 0;
    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      const shape = checkRowShape({ name: row.name, email: row.email, class: row.class, under18: row.under18 }, seen, cleanName);
      if (!shape.ok) {
        bad.push({ row: i + 1, reason: shape.reason });
        continue;
      }
      if (await emailTaken(ctx, shape.email)) {
        bad.push({ row: i + 1, reason: "email_in_use" });
        inUse += 1;
        continue;
      }
      const parsed = parseClassLabel(row.class);
      const cls = parsed ? byLabel.get(`${parsed.grade}|${sectionKey(parsed.section)}`) : undefined;
      if (!cls) {
        bad.push({ row: i + 1, reason: "class_not_found" });
        continue;
      }
      if (mc.role === "teacher" && !mc.classIds.includes(cls._id)) {
        bad.push({ row: i + 1, reason: "class_not_in_scope" });
        continue;
      }
      good.push({ name: shape.name, email: shape.email, under18: shape.under18, classId: cls._id });
    }

    if (inUse > 0) await countInUse(ctx, key, inUse);
    if (bad.length > 0) return { ok: false as const, code: "bad_rows", badRows: bad };

    for (const g of good) {
      await insertInvite(ctx, {
        draft: { role: "student", instituteId, classId: g.classId, under18: g.under18 },
        email: g.email,
        name: g.name,
        createdBy: mc.member._id,
      });
    }
    return { ok: true as const, count: good.length };
  },
});

async function manageable(ctx: MutationCtx, mc: MemberContext, inviteId: Id<"invites">): Promise<Doc<"invites">> {
  const invite = await ctx.db.get(inviteId);
  // An invite the caller could not create is not admitted to exist.
  if (!invite || !(await canManageInvite(ctx, mc, invite))) fail("forbidden");
  return invite;
}
const isPending = (invite: Doc<"invites">) => invite.claimedAt === undefined && invite.revokedAt === undefined;

// Fix a typing mistake in the address of a pending invite. The same checks as creating one, including the neutral `email_in_use`.
export const update = mutation({
  args: { inviteId: v.id("invites"), email: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refusal),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const invite = await manageable(ctx, mc, args.inviteId);
    const key = inUseKey(mc, invite.instituteId);
    if (await inUseExhausted(ctx, key)) return { ok: false as const, code: "rate_limited" };
    if (!isPending(invite)) return { ok: false as const, code: "invite_not_pending" };
    const email = normaliseEmail(args.email);
    if (!email) return { ok: false as const, code: "bad_email" };
    if (email !== invite.email && (await emailTaken(ctx, email))) {
      await countInUse(ctx, key);
      return { ok: false as const, code: "email_in_use" };
    }
    await ctx.db.patch(invite._id, { email });
    await logAccess(ctx, { actor: mc.member._id, action: "invite.update", instituteId: invite.instituteId, inviteId: invite._id });
    return { ok: true as const };
  },
});

// A DHI admin can revoke any invite, so a squatted invite can be cleared.
export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.object({ revoked: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const invite = await manageable(ctx, mc, args.inviteId);
    if (!isPending(invite)) fail("invite_not_pending");
    await ctx.db.patch(invite._id, { revokedAt: Date.now() });
    await logAccess(ctx, { actor: mc.member._id, action: "invite.revoke", instituteId: invite.instituteId, inviteId: invite._id });
    return { revoked: true as const };
  },
});

// Another 14 days from now. An expired invite still blocks a new invite for the address until it is revoked or extended.
export const extend = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.object({ expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const invite = await manageable(ctx, mc, args.inviteId);
    if (!isPending(invite)) fail("invite_not_pending");
    const expiresAt = Date.now() + INVITE_MS;
    await ctx.db.patch(invite._id, { expiresAt });
    await logAccess(ctx, { actor: mc.member._id, action: "invite.extend", instituteId: invite.instituteId, inviteId: invite._id });
    return { expiresAt };
  },
});

const inviteRow = v.object({
  _id: v.id("invites"),
  role: roleValidator,
  email: v.string(),
  name: v.string(),
  classId: v.union(v.id("classes"), v.null()),
  className: v.union(v.string(), v.null()),
  under18: v.union(v.boolean(), v.null()),
  expiresAt: v.number(),
  status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("revoked")),
});

const statusOf = (i: Doc<"invites">) => (i.revokedAt !== undefined ? ("revoked" as const) : i.claimedAt !== undefined ? ("claimed" as const) : ("pending" as const));

// Invites in the caller's scope, 25 a page. The page says `expiresAt` and the screen compares it with its own clock (a query never reads it).
// A teacher names one of their own classes. An institute admin sees their institute's. A DHI admin may name an institute or see all.
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("pending"), v.literal("claimed"), v.literal("revoked"))),
    classId: v.optional(v.id("classes")),
    instituteId: v.optional(v.id("institutes")),
  },
  returns: paginationResultValidator(inviteRow),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };
    const wanted = args.status;
    const keep = (i: Doc<"invites">) => (wanted ? statusOf(i) === wanted : true);

    let page;
    if (mc.role === "teacher") {
      if (!args.classId || !mc.classIds.includes(args.classId)) fail("class_not_in_scope");
      const classId = args.classId;
      page = await ctx.db.query("invites").withIndex("by_classId", (q) => q.eq("classId", classId)).order("desc").paginate(opts);
    } else if (mc.role === "institute_admin") {
      if (args.instituteId !== undefined && args.instituteId !== mc.member.instituteId) fail("forbidden");
      const instituteId = mc.member.instituteId;
      page = await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).order("desc").paginate(opts);
    } else if (mc.role === "dhi_admin") {
      if (args.instituteId) {
        const instituteId = args.instituteId;
        page = await ctx.db.query("invites").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).order("desc").paginate(opts);
      } else {
        page = await ctx.db.query("invites").order("desc").paginate(opts);
      }
    } else {
      fail("forbidden");
    }

    const rows = await Promise.all(
      page.page.filter(keep).map(async (i) => {
        const cls = i.classId ? await ctx.db.get(i.classId) : null;
        return {
          _id: i._id,
          role: i.role,
          email: i.email,
          name: i.name,
          classId: i.classId ?? null,
          className: cls ? `${cls.grade} ${cls.section}` : null,
          under18: i.under18 ?? null,
          expiresAt: i.expiresAt,
          status: statusOf(i),
        };
      }),
    );
    return { ...page, page: rows };
  },
});
