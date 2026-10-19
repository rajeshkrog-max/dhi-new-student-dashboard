// Institutes (spec house/0002). Only a DHI admin creates, renames, suspends and lists them. A suspended institute locks every member out at
// once (requireMember refuses them), and a DHI admin can still see it and reinstate it (AC-16).
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanName, fail } from "./helpers";
import { logAccess, requireDhiAdmin } from "./houseAuth";
import { PAGE_SIZE } from "./houseCore";

const statusValidator = v.union(v.literal("active"), v.literal("suspended"));
const instituteRow = v.object({
  _id: v.id("institutes"),
  name: v.string(),
  status: statusValidator,
  plan: v.union(v.string(), v.null()),
});

const nameKeyOf = (name: string) => name.trim().toLowerCase();
const cleanPlan = (raw: string | undefined) => {
  const plan = raw?.trim().replace(/\s+/g, " ");
  return plan ? plan.slice(0, 40) : undefined;
};

export const create = mutation({
  args: { name: v.string(), plan: v.optional(v.string()) },
  returns: v.object({ instituteId: v.id("institutes") }),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const name = cleanName(args.name);
    if (!name) fail("bad_name");
    const nameKey = nameKeyOf(name);
    if (await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first()) fail("name_taken");
    const plan = cleanPlan(args.plan);
    const instituteId = await ctx.db.insert("institutes", { name, nameKey, status: "active", ...(plan ? { plan } : {}) });
    await logAccess(ctx, { actor: mc.member._id, action: "inst.create", instituteId });
    return { instituteId };
  },
});

// Rename, suspend, reinstate, or change the plan label. Suspending and reinstating are written to the access log.
export const update = mutation({
  args: { instituteId: v.id("institutes"), name: v.optional(v.string()), status: v.optional(statusValidator), plan: v.optional(v.string()) },
  returns: v.object({ status: statusValidator }),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const institute = await ctx.db.get(args.instituteId);
    if (!institute) fail("not_found");

    const patch: { name?: string; nameKey?: string; plan?: string; status?: "active" | "suspended" } = {};
    if (args.name !== undefined) {
      const name = cleanName(args.name);
      if (!name) fail("bad_name");
      const nameKey = nameKeyOf(name);
      const other = await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first();
      if (other && other._id !== institute._id) fail("name_taken");
      patch.name = name;
      patch.nameKey = nameKey;
    }
    if (args.plan !== undefined) patch.plan = cleanPlan(args.plan);
    if (args.status !== undefined && args.status !== institute.status) patch.status = args.status;
    if (Object.keys(patch).length > 0) await ctx.db.patch(institute._id, patch);
    if (patch.status) {
      await logAccess(ctx, { actor: mc.member._id, action: patch.status === "suspended" ? "inst.suspend" : "inst.reinstate", instituteId: institute._id });
    }
    return { status: patch.status ?? institute.status };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(instituteRow),
  handler: async (ctx, args) => {
    await requireDhiAdmin(ctx);
    const page = await ctx.db
      .query("institutes")
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) });
    return { ...page, page: page.page.map((i) => ({ _id: i._id, name: i.name, status: i.status, plan: i.plan ?? null })) };
  },
});
