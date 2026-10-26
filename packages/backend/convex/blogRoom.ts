// The blog room's hooks into export and erase (spec house/0014 and house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. A page of the student's own posts for their download (title, tag and cleaned body), and a page of their posts
// and comments deleted for the erase.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

export const blogRoom: RoomEntry = {
  room: "blog",
  table: "blogPosts",
  kinds: ["writing"],
  // Posts first (cursor "p:" and the creation time of the last post sent, read with `gt` on the index, oldest first), then the student's own comments
  // (cursor "c:" and the same). A page holds one kind of row, and the rows say which.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    if (cursor === null || cursor.startsWith("p:")) {
      const after = cursor === null ? null : Number(cursor.slice(2));
      const rows = await ctx.db
        .query("blogPosts")
        .withIndex("by_authorMemberId", (q) => (after === null ? q.eq("authorMemberId", memberId) : q.eq("authorMemberId", memberId).gt("_creationTime", after)))
        .take(limit + 1);
      const page = rows.slice(0, limit);
      return {
        // The photo itself is not in the download (a file does not fit a page of rows); the row says whether the post had one.
        rows: page.map((r) => ({ kind: "post", title: r.title, tag: r.tag, body: r.body, status: r.status, createdAt: r.createdAt, hadPhoto: r.photoId !== undefined })),
        next: rows.length > limit ? `p:${page[page.length - 1]._creationTime}` : "c:0",
      };
    }
    const after = Number(cursor.slice(2));
    const rows = await ctx.db.query("blogComments").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId).gt("_creationTime", after)).take(limit + 1);
    const page = rows.slice(0, limit);
    return {
      rows: page.map((c) => ({ kind: "comment", text: c.text, status: c.status, createdAt: c.createdAt })),
      next: rows.length > limit ? `c:${page[page.length - 1]._creationTime}` : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const comments = await ctx.db.query("blogComments").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId)).take(limit);
    for (const c of comments) await ctx.db.delete(c._id);
    const posts = await ctx.db.query("blogPosts").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId)).take(limit);
    let deleted = comments.length;
    let more = false;
    for (const p of posts) {
      // Classmates' comments on the post go with it, so none is left pointing at a post that no longer exists. A post with many keeps for the next call.
      const others = await ctx.db.query("blogComments").withIndex("by_postId", (q) => q.eq("postId", p._id)).take(limit);
      for (const c of others) await ctx.db.delete(c._id);
      deleted += others.length;
      if (others.length >= limit) {
        more = true;
        continue;
      }
      if (p.photoId !== undefined) await ctx.storage.delete(p.photoId);
      await ctx.db.delete(p._id);
      deleted += 1;
    }
    const done = comments.length < limit && posts.length < limit && !more;
    return { deleted, done };
  },
};
