// The blog room (spec house/0014). A student writes a post; it stays pending until a teacher of the author's class approves it. Classmates in the
// institute read only approved posts and comments; the author always reads their own. Every function starts with `requireMember`, so the consent
// gate applies. The body is cleaned on the server before it is stored (blogRules.ts), so a script a student slips past the screen is removed.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isHeldByPicture } from "./avatarState";
import { inGoodStanding } from "./consentState";
import { fail } from "./helpers";
import { requireMember, teacherClassIds } from "./houseAuth";
import { dayOf, shiftDay, todayOf } from "./dayRules";
import { MAX_AGE_DAYS, recordEvent } from "./eventLog";
import { rateLimiter } from "./limits";
import { MAX_COMMENT, bodyProblem, cleanBody, hasList, hasParagraphs, isPostTag, movingTtr, photoFileProblem, titleProblem, wordsOf } from "./blogRules";

// A place to upload the photo of a post: the browser sends the file there and gets a storage id back, which `write` then checks. Twelve an hour for
// each student. A file that is uploaded and never used is removed by the daily storage clean up (reportCopy.sweep) after a day.
export const photoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "blogPhoto", { key: mc.member._id })).ok) fail("slow_down");
    return await ctx.storage.generateUploadUrl();
  },
});

// Whether an uploaded file may be a post's photo: the file rule (blogRules.photoFileProblem), and held by no other post and by no profile picture.
// A mutation cannot read a file's bytes, so the type is the one the upload declared: the screen re-saves every picture as a real JPEG and a teacher
// sees every photo before classmates do. Returns the problem code or null.
async function photoProblem(ctx: MutationCtx, id: Id<"_storage">, now: number): Promise<"bad_photo" | null> {
  const problem = photoFileProblem(await ctx.db.system.get("_storage", id), now);
  if (problem) return problem;
  if (await ctx.db.query("blogPosts").withIndex("by_photoId", (q) => q.eq("photoId", id)).first()) return "bad_photo";
  if (await isHeldByPicture(ctx, id)) return "bad_photo";
  return null;
}

// A student writes a post, with one photo if they like. It is pending until a teacher of their class approves it; the photo is seen by classmates
// only then, and is deleted if a teacher removes the post.
export const write = mutation({
  args: { title: v.string(), tag: v.string(), body: v.string(), photoId: v.optional(v.id("_storage")) },
  returns: v.id("blogPosts"),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    // Six new posts an hour. The refusal is thrown, which rolls the token back too, so only posts that were really stored use the allowance.
    if (!(await rateLimiter.limit(ctx, "blogPost", { key: mc.member._id })).ok) fail("slow_down");
    const titleBad = titleProblem(args.title);
    if (titleBad) fail(titleBad);
    if (!isPostTag(args.tag)) fail("bad_tag");
    const bodyBad = bodyProblem(args.body);
    if (bodyBad) fail(bodyBad);
    const now = Date.now();
    if (args.photoId !== undefined && (await photoProblem(ctx, args.photoId, now))) fail("bad_photo");
    return await ctx.db.insert("blogPosts", {
      authorMemberId: mc.member._id,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      title: args.title.trim(),
      tag: args.tag,
      body: cleanBody(args.body),
      ...(args.photoId !== undefined ? { photoId: args.photoId } : {}),
      status: "pending",
      createdAt: now,
    });
  },
});

// The posts a student may read: the approved posts of their institute, and their own posts whatever their status. Each carries its approved
// comments (and the author's own comments whatever their status).
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      postId: v.id("blogPosts"),
      title: v.string(),
      tag: v.string(),
      body: v.string(),
      status: v.string(),
      mine: v.boolean(),
      authorName: v.string(),
      photoUrl: v.union(v.string(), v.null()),
      comments: v.array(v.object({ commentId: v.id("blogComments"), text: v.string(), status: v.string(), mine: v.boolean() })),
    }),
  ),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const rows = await ctx.db.query("blogPosts").withIndex("by_instituteId", (q) => q.eq("instituteId", mc.member.instituteId as NonNullable<typeof mc.member.instituteId>)).order("desc").take(100);
    const out = [];
    // A student who withdrew, was removed or is not through consent is not shown to classmates: their posts and comments go quiet.
    const standing = new Map<Id<"members">, boolean>();
    const inStanding = async (memberId: Id<"members">): Promise<boolean> => {
      const known = standing.get(memberId);
      if (known !== undefined) return known;
      const member = await ctx.db.get(memberId);
      const ok = member !== null && (await inGoodStanding(ctx, member));
      standing.set(memberId, ok);
      return ok;
    };
    for (const post of rows) {
      const mine = post.authorMemberId === mc.member._id;
      if (post.status !== "approved" && !mine) continue;
      if (!mine && !(await inStanding(post.authorMemberId))) continue;
      const author = await ctx.db.get(post.authorMemberId);
      const comments = (await ctx.db.query("blogComments").withIndex("by_postId", (q) => q.eq("postId", post._id)).take(100));
      const shown = [];
      for (const c of comments) {
        const own = c.authorMemberId === mc.member._id;
        if (own || (c.status === "approved" && (await inStanding(c.authorMemberId)))) shown.push(c);
      }
      out.push({
        postId: post._id,
        title: post.title,
        tag: post.tag,
        body: post.body,
        status: post.status,
        mine,
        authorName: author?.name ?? "",
        // The photo is seen by the author, and by classmates only once a teacher has approved the post.
        photoUrl: post.photoId !== undefined && (post.status === "approved" || mine) ? await ctx.storage.getUrl(post.photoId) : null,
        comments: shown.map((c) => ({ commentId: c._id, text: c.text, status: c.status, mine: c.authorMemberId === mc.member._id })),
      });
    }
    return out;
  },
});

// A student comments on an approved post in their institute. The comment is pending until a teacher of the post author's class approves it.
export const comment = mutation({
  args: { postId: v.id("blogPosts"), text: v.string() },
  returns: v.id("blogComments"),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "blogComment", { key: mc.member._id })).ok) fail("slow_down");
    const post = await ctx.db.get(args.postId);
    if (!post || post.instituteId !== mc.member.instituteId || post.status !== "approved") fail("not_found");
    const postAuthor = await ctx.db.get(post.authorMemberId);
    if (!postAuthor || !(await inGoodStanding(ctx, postAuthor))) fail("not_found");
    const text = args.text.trim();
    if (text.length === 0 || [...text].length > MAX_COMMENT) fail("bad_text");
    // Plain text only: the markup characters are escaped, so a comment never carries a tag.
    const plain = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return await ctx.db.insert("blogComments", {
      postId: post._id,
      authorMemberId: mc.member._id,
      instituteId: post.instituteId,
      text: plain,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Whether a teacher may review a student's post or comment: a teacher of the author's class, in the same institute.
async function teacherOfAuthor(ctx: MutationCtx, teacherId: Id<"members">, authorId: Id<"members">, instituteId: Id<"institutes">): Promise<void> {
  const teacher = await ctx.db.get(teacherId);
  if (!teacher || teacher.role !== "teacher" || teacher.instituteId !== instituteId) fail("forbidden");
  const author = await ctx.db.get(authorId);
  if (!author?.classId) fail("forbidden");
  const mine = await teacherClassIds(ctx, teacherId);
  if (!mine.includes(author.classId)) fail("forbidden");
}

const ACTIONS = { approve: "approved", hide: "hidden", remove: "removed" } as const;

// A teacher approves, hides or removes a post.
// When the Brain counts a post as published: the moment the student wrote it, or the moment of approval when the post is older than the event log accepts.
export function publishedTime(wroteAt: number, now: number): number {
  const wrote = Math.floor(wroteAt);
  return dayOf(wrote) >= shiftDay(todayOf(now), -MAX_AGE_DAYS) ? wrote : now;
}

export const review = mutation({
  args: { postId: v.id("blogPosts"), action: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const status = (ACTIONS as Record<string, string>)[args.action];
    if (!status) fail("bad_action");
    const post: Doc<"blogPosts"> | null = await ctx.db.get(args.postId);
    if (!post) fail("not_found");
    await teacherOfAuthor(ctx, mc.member._id, post.authorMemberId, post.instituteId);
    // A post of a student who withdrew, was removed or is not through consent cannot be approved, and the teacher is told only that it is not found:
    // the student's own side of consent is not shown to the school (spec house/0005, AC-20). Hiding or removing it stays possible.
    if (status === "approved") {
      const author = await ctx.db.get(post.authorMemberId);
      if (!author || !(await inGoodStanding(ctx, author))) fail("not_found");
    }
    // Removing a post removes its photo with it, at once.
    if (status === "removed" && post.photoId !== undefined) {
      await ctx.storage.delete(post.photoId);
      await ctx.db.patch(post._id, { photoId: undefined });
    }
    // The first approval makes the post visible to the class, and that is the one moment the Brain counts as a published post. A post hidden and
    // approved again keeps its first time (`publishedAt`), so it never writes a second event.
    const now = Date.now();
    const firstApproval = status === "approved" && post.publishedAt === undefined;
    if (firstApproval) {
      // The event is dated to when the student wrote the post, so a teacher's approval on a day the student did nothing never makes that day a logged day.
      // A post older than the log accepts (a week) is dated to the approval instead, so the approval is never refused for it.
      const about = `post:${post._id}`;
      await recordEvent(ctx, {
        by: mc,
        memberId: post.authorMemberId,
        room: "blog",
        type: "blog.published",
        payload: { tag: post.tag, words: Math.min(wordsOf(post.body), 2000), list: hasList(post.body), paragraphs: hasParagraphs(post.body), ...(movingTtr(post.body) !== null ? { ttr: movingTtr(post.body) as number } : {}) },
        occurredAt: publishedTime(post._creationTime, now),
        eventKey: `${about}-0`,
        about,
      });
    }
    await ctx.db.patch(post._id, { status, reviewedBy: mc.member._id, ...(firstApproval ? { publishedAt: now } : {}) });
    return { ok: true as const };
  },
});

// A teacher approves, hides or removes a comment.
export const reviewComment = mutation({
  args: { commentId: v.id("blogComments"), action: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const status = (ACTIONS as Record<string, string>)[args.action];
    if (!status) fail("bad_action");
    const comment = await ctx.db.get(args.commentId);
    if (!comment) fail("not_found");
    await teacherOfAuthor(ctx, mc.member._id, comment.authorMemberId, comment.instituteId);
    if (status === "approved") {
      const author = await ctx.db.get(comment.authorMemberId);
      if (!author || !(await inGoodStanding(ctx, author))) fail("not_found");
    }
    // The first approval counts the comment for the Brain: a `blog.commented` for the commenter (their own doing) and a `blog.replied` for the author of the
    // post (not a log). Dated to when the comment was written, like a post, and written once.
    const firstApproval = status === "approved" && comment.countedAt === undefined;
    if (firstApproval) {
      const now = Date.now();
      const post = await ctx.db.get(comment.postId);
      const about = `comment:${comment._id}`;
      const occurredAt = publishedTime(comment.createdAt, now);
      await recordEvent(ctx, { by: mc, memberId: comment.authorMemberId, room: "blog", type: "blog.commented", payload: {}, occurredAt, eventKey: `${about}-0`, about });
      if (post && post.authorMemberId !== comment.authorMemberId) {
        // The post's author may have withdrawn; the commenter's event stands, and the approval is never refused for it.
        try {
          await recordEvent(ctx, { by: mc, memberId: post.authorMemberId, room: "blog", type: "blog.replied", payload: {}, occurredAt, eventKey: `${about}-r`, about: `${about}-r` });
        } catch {
          // Nothing half written (the log checks first), so the reply simply is not counted.
        }
      }
    }
    await ctx.db.patch(comment._id, { status, reviewedBy: mc.member._id, ...(firstApproval ? { countedAt: Date.now() } : {}) });
    return { ok: true as const };
  },
});

// The posts and comments a teacher must review: the pending ones of the author's class, in the teacher's institute.
export const pendingForTeacher = query({
  args: {},
  returns: v.object({
    posts: v.array(v.object({ postId: v.id("blogPosts"), title: v.string(), tag: v.string(), body: v.string(), authorName: v.string(), photoUrl: v.union(v.string(), v.null()) })),
    comments: v.array(v.object({ commentId: v.id("blogComments"), text: v.string(), postTitle: v.string(), authorName: v.string() })),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const mine = await teacherClassIds(ctx, mc.member._id);
    const instituteId = mc.member.instituteId as NonNullable<typeof mc.member.instituteId>;
    const posts = [];
    const comments = [];
    const rows = await ctx.db.query("blogPosts").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).order("desc").take(200);
    for (const post of rows) {
      if (post.status !== "pending") continue;
      const author = await ctx.db.get(post.authorMemberId);
      if (!author?.classId || !mine.includes(author.classId) || !(await inGoodStanding(ctx, author))) continue;
      posts.push({ postId: post._id, title: post.title, tag: post.tag, body: post.body, authorName: author.name, photoUrl: post.photoId !== undefined ? await ctx.storage.getUrl(post.photoId) : null });
    }
    const pending = await ctx.db.query("blogComments").withIndex("by_instituteId_and_status", (q) => q.eq("instituteId", instituteId).eq("status", "pending")).take(200);
    for (const c of pending) {
      const author = await ctx.db.get(c.authorMemberId);
      if (!author?.classId || !mine.includes(author.classId) || !(await inGoodStanding(ctx, author))) continue;
      const post = await ctx.db.get(c.postId);
      comments.push({ commentId: c._id, text: c.text, postTitle: post?.title ?? "", authorName: author.name });
    }
    return { posts, comments };
  },
});
