// Classes and the teachers assigned to them (spec house/0002). A class is a grade and a section of one institute. Classes are made here, by
// an institute admin or a DHI admin, and never by an upload. A teacher's access is scoped to the classes assigned to them, re read on every
// call by requireMember.
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fail } from "./helpers";
import { logAccess, requireMember, type MemberContext } from "./houseAuth";
import { cleanSection, PAGE_SIZE, sectionKey } from "./houseCore";
import { classValidator } from "./schema";

const classRow = v.object({
  _id: v.id("classes"),
  instituteId: v.id("institutes"),
  grade: classValidator,
  section: v.string(),
  archived: v.boolean(),
});
const toRow = (c: Doc<"classes">) => ({ _id: c._id, instituteId: c.instituteId, grade: c.grade, section: c.section, archived: c.archivedAt !== undefined });

// The institute an institute admin or DHI admin works in. A DHI admin names it; an institute admin cannot name another.
async function workingInstitute(ctx: QueryCtx, mc: MemberContext, named: Id<"institutes"> | undefined): Promise<Id<"institutes">> {
  if (mc.role === "institute_admin") {
    if (named !== undefined && named !== mc.member.instituteId) fail("forbidden");
    return mc.member.instituteId as Id<"institutes">;
  }
  if (mc.role !== "dhi_admin") fail("forbidden");
  if (!named) fail("not_found");
  if (!(await ctx.db.get(named))) fail("not_found");
  return named;
}

// A class of the caller's own scope, or `not_found` (a class of another institute is never admitted to exist).
async function classInScope(ctx: QueryCtx, mc: MemberContext, classId: Id<"classes">): Promise<Doc<"classes">> {
  const cls = await ctx.db.get(classId);
  if (!cls) fail("not_found");
  if (mc.role !== "dhi_admin" && cls.instituteId !== mc.member.instituteId) fail("not_found");
  return cls;
}

async function findClass(ctx: QueryCtx, instituteId: Id<"institutes">, grade: Doc<"classes">["grade"], section: string) {
  const key = sectionKey(section);
  const rows = await ctx.db.query("classes").withIndex("by_instituteId_and_grade", (q) => q.eq("instituteId", instituteId).eq("grade", grade)).take(200);
  return rows.find((c) => sectionKey(c.section) === key) ?? null;
}

export const create = mutation({
  args: { grade: classValidator, section: v.string(), instituteId: v.optional(v.id("institutes")) },
  returns: v.object({ classId: v.id("classes") }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const instituteId = await workingInstitute(ctx, mc, args.instituteId);
    const institute = await ctx.db.get(instituteId);
    if (institute?.status === "suspended") fail("institute_suspended");
    const section = cleanSection(args.section);
    if (!section) fail("bad_section");
    if (await findClass(ctx, instituteId, args.grade, section)) fail("class_exists");
    const classId = await ctx.db.insert("classes", { instituteId, grade: args.grade, section });
    await logAccess(ctx, { actor: mc.member._id, action: "class.create", instituteId });
    return { classId };
  },
});

// Archived, never deleted. Refused while an active student still points at the class, so nobody is left in an archived class.
export const archive = mutation({
  args: { classId: v.id("classes") },
  returns: v.object({ archived: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "institute_admin" && mc.role !== "dhi_admin") fail("forbidden");
    const cls = await classInScope(ctx, mc, args.classId);
    if (cls.archivedAt !== undefined) return { archived: true as const };
    const members = await ctx.db.query("members").withIndex("by_classId", (q) => q.eq("classId", cls._id)).take(500);
    if (members.some((m) => m.status === "active")) fail("class_in_use");
    await ctx.db.patch(cls._id, { archivedAt: Date.now() });
    await logAccess(ctx, { actor: mc.member._id, action: "class.archive", instituteId: cls.instituteId });
    return { archived: true as const };
  },
});

// Classes in scope, 25 a page. A teacher sees only the classes assigned to them, an institute admin their institute's, a DHI admin names an
// institute.
export const list = query({
  args: { paginationOpts: paginationOptsValidator, instituteId: v.optional(v.id("institutes")) },
  returns: paginationResultValidator(classRow),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };
    if (mc.role === "teacher") {
      const page = await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).paginate(opts);
      const classes = await Promise.all(page.page.map((row) => ctx.db.get(row.classId)));
      return { ...page, page: classes.filter((c): c is Doc<"classes"> => c !== null).map(toRow) };
    }
    const instituteId = await workingInstitute(ctx, mc, args.instituteId);
    const page = await ctx.db.query("classes").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).paginate(opts);
    return { ...page, page: page.page.map(toRow) };
  },
});

// The teachers assigned to a class, 25 a page, so an admin can see who has it (the staff Classes screen). Admins only: a teacher's own classes
// come from `list`.
export const teachers = query({
  args: { classId: v.id("classes"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({ memberId: v.id("members"), name: v.string(), status: v.union(v.literal("active"), v.literal("removed")) })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "institute_admin" && mc.role !== "dhi_admin") fail("forbidden");
    const cls = await classInScope(ctx, mc, args.classId);
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };
    const page = await ctx.db.query("teacherClasses").withIndex("by_classId", (q) => q.eq("classId", cls._id)).paginate(opts);
    const people = await Promise.all(page.page.map((row) => ctx.db.get(row.memberId)));
    return {
      ...page,
      page: people.filter((m): m is Doc<"members"> => m !== null).map((m) => ({ memberId: m._id, name: m.name, status: m.status })),
    };
  },
});

async function teacherAndClass(ctx: MutationCtx, mc: MemberContext, classId: Id<"classes">, memberId: Id<"members">) {
  if (mc.role !== "institute_admin" && mc.role !== "dhi_admin") fail("forbidden");
  const cls = await classInScope(ctx, mc, classId);
  const teacher = await ctx.db.get(memberId);
  if (!teacher || teacher.instituteId !== cls.instituteId) fail("not_found");
  if (teacher.role !== "teacher") fail("not_a_teacher");
  return { cls, teacher };
}

export const assignTeacher = mutation({
  args: { classId: v.id("classes"), memberId: v.id("members") },
  returns: v.object({ assigned: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const { cls, teacher } = await teacherAndClass(ctx, mc, args.classId, args.memberId);
    if (cls.archivedAt !== undefined) fail("class_archived");
    const existing = await ctx.db
      .query("teacherClasses")
      .withIndex("by_memberId_and_classId", (q) => q.eq("memberId", teacher._id).eq("classId", cls._id))
      .first();
    if (!existing) {
      await ctx.db.insert("teacherClasses", { memberId: teacher._id, classId: cls._id, instituteId: cls.instituteId });
      await logAccess(ctx, { actor: mc.member._id, action: "class.assign", instituteId: cls.instituteId, targetMemberId: teacher._id });
    }
    return { assigned: true as const };
  },
});

// Takes effect on the teacher's very next call, because requireMember re reads their assignments every time (AC-7).
export const unassignTeacher = mutation({
  args: { classId: v.id("classes"), memberId: v.id("members") },
  returns: v.object({ assigned: v.literal(false) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const { cls, teacher } = await teacherAndClass(ctx, mc, args.classId, args.memberId);
    const existing = await ctx.db
      .query("teacherClasses")
      .withIndex("by_memberId_and_classId", (q) => q.eq("memberId", teacher._id).eq("classId", cls._id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await logAccess(ctx, { actor: mc.member._id, action: "class.unassign", instituteId: cls.instituteId, targetMemberId: teacher._id });
    }
    return { assigned: false as const };
  },
});
