// The meals room's hooks into export and erase (spec house/0010 and house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. A page of the student's plates for their download (day, meal, food name, count and group), and a page of their
// plates deleted for the erase, together with the custom dishes they made (the catalog is not theirs and is never deleted).
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

export const mealsRoom: RoomEntry = {
  room: "meals",
  table: "mealPlates",
  kinds: ["meals"],
  // The cursor is the creation time of the last plate sent, read with `gt` on the index, oldest first.
  // After the plates, pages of the custom dishes the student made (cursor `f:` and the creation time of the last dish sent).
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    if (cursor !== null && cursor.startsWith("f:")) {
      const after = Number(cursor.slice(2));
      if (Number.isNaN(after)) return { rows: [], next: null };
      const dishes = await ctx.db
        .query("foods")
        .withIndex("by_ownerMemberId", (q) => q.eq("ownerMemberId", memberId).gt("_creationTime", after))
        .take(limit + 1);
      const page = dishes.slice(0, limit);
      return {
        rows: page.map((f) => ({ dish: f.nameEn, nameHi: f.nameHi ?? "", group: f.group, processing: f.processing, serving: f.serving, status: f.status })),
        next: dishes.length > limit ? `f:${page[page.length - 1]._creationTime}` : null,
      };
    }
    const rows = await ctx.db
      .query("mealPlates")
      .withIndex("by_memberId", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("_creationTime", Number(cursor))))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    const foods = await Promise.all(page.map((r) => ctx.db.get(r.foodId)));
    const platesRows = page.map((r, i) => ({ day: r.day, meal: r.meal, food: foods[i]?.nameEn ?? "", count: r.count, group: r.group, removed: r.removedAt !== undefined }));
    if (rows.length > limit) return { rows: platesRows, next: String(page[page.length - 1]._creationTime) };
    const someDish = await ctx.db.query("foods").withIndex("by_ownerMemberId", (q) => q.eq("ownerMemberId", memberId)).first();
    return { rows: platesRows, next: someDish ? "f:0" : null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const plates = await ctx.db.query("mealPlates").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const p of plates) await ctx.db.delete(p._id);
    const mine = await ctx.db.query("foods").withIndex("by_ownerMemberId", (q) => q.eq("ownerMemberId", memberId)).take(limit);
    for (const f of mine) await ctx.db.delete(f._id);
    return { deleted: plates.length + mine.length, done: plates.length < limit && mine.length < limit };
  },
};
