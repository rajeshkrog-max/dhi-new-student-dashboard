// The modules room (spec house/0013). DHI admins upload and approve films; a student has no function that adds one. A student watches an approved
// film: the server gives a short play link, records how far they watched (only a little faster than real time at most), and writes the score
// once, when its own record shows the film was watched to its end. Every function starts with `requireMember` or `requireDhiAdmin`, so the
// consent gate applies to students.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireDhiAdmin, requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { LINK_TTL_MS, progressAfter, playUrlOf, reachedEnd, uploadProblem, CHECKS_FOR_ACADEMIC } from "./moduleRules";

const coverOk = (path: string): boolean => /^\/[A-Za-z0-9_\-/.]+\.(jpg|jpeg|png|webp)$/.test(path) && !path.includes("..") && !path.includes("//");

const checkArg = v.object({ question: v.string(), options: v.array(v.string()), rightOption: v.number() });

// DHI admin: uploads a film. It stays pending until a DHI admin approves it. An academic film carries exactly two check questions, and no other
// category carries any.
export const upload = mutation({
  args: {
    title: v.string(),
    category: v.string(),
    blurb: v.string(),
    cover: v.string(),
    hostRef: v.string(),
    durationSec: v.number(),
    scoreValue: v.number(),
    checks: v.array(checkArg),
  },
  returns: v.id("films"),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const problem = uploadProblem(args);
    if (problem) fail(problem);
    if (!coverOk(args.cover)) fail("bad_cover");
    const filmId = await ctx.db.insert("films", {
      title: args.title.trim(),
      category: args.category,
      blurb: args.blurb.trim(),
      cover: args.cover,
      hostRef: args.hostRef,
      durationSec: args.durationSec,
      scoreValue: args.scoreValue,
      status: "pending",
      uploadedBy: mc.member._id,
      createdAt: Date.now(),
    });
    for (const [order, c] of args.checks.entries()) {
      await ctx.db.insert("filmChecks", { filmId, order, question: c.question.trim(), options: c.options.map((o) => o.trim()), rightOption: c.rightOption });
    }
    return filmId;
  },
});

// DHI admin: the films waiting for approval, with how many check questions each carries.
export const pending = query({
  args: {},
  returns: v.array(v.object({ filmId: v.id("films"), title: v.string(), category: v.string(), checks: v.number() })),
  handler: async (ctx) => {
    await requireDhiAdmin(ctx);
    const rows = await ctx.db.query("films").withIndex("by_status", (q) => q.eq("status", "pending")).take(100);
    const out = [];
    for (const f of rows) {
      const checks = await ctx.db.query("filmChecks").withIndex("by_filmId", (q) => q.eq("filmId", f._id)).take(4);
      out.push({ filmId: f._id, title: f.title, category: f.category, checks: checks.length });
    }
    return out;
  },
});

// DHI admin: approves a film. An academic film is refused without its two check questions.
export const approve = mutation({
  args: { filmId: v.id("films") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const film = await ctx.db.get(args.filmId);
    if (!film || film.status !== "pending") fail("not_found");
    if (film.category === "academic") {
      const checks = await ctx.db.query("filmChecks").withIndex("by_filmId", (q) => q.eq("filmId", film._id)).take(4);
      if (checks.length !== CHECKS_FOR_ACADEMIC) fail("bad_check");
    }
    await ctx.db.patch(film._id, { status: "approved", approvedBy: mc.member._id });
    return { ok: true as const };
  },
});

// The approved films, each with the student's own progress, and the totals (films kept and score). Never the host reference or a check answer.
export const list = query({
  args: {},
  returns: v.object({
    films: v.array(
      v.object({
        filmId: v.id("films"),
        title: v.string(),
        category: v.string(),
        blurb: v.string(),
        cover: v.string(),
        scoreValue: v.number(),
        durationSec: v.number(),
        ratio: v.number(),
        kept: v.boolean(),
      }),
    ),
    keptCount: v.number(),
    score: v.number(),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const films = await ctx.db.query("films").withIndex("by_status", (q) => q.eq("status", "approved")).take(100);
    const out = [];
    let keptCount = 0;
    let score = 0;
    for (const f of films) {
      const row = await ctx.db.query("filmProgress").withIndex("by_memberId_and_filmId", (q) => q.eq("memberId", mc.member._id).eq("filmId", f._id)).first();
      const kept = row?.scored === true;
      if (kept) {
        keptCount += 1;
        score += f.scoreValue;
      }
      out.push({
        filmId: f._id,
        title: f.title,
        category: f.category,
        blurb: f.blurb,
        cover: f.cover,
        scoreValue: f.scoreValue,
        durationSec: f.durationSec,
        ratio: kept ? 1 : Math.min(1, (row?.furthestSec ?? 0) / f.durationSec),
        kept,
      });
    }
    return { films: out, keptCount, score };
  },
});

type Actor = Pick<MemberContext, "member" | "role" | "classIds">;

// The film and the student's progress row (made when the first link is asked for). Refuses a film that is not approved.
async function filmAndProgress(ctx: MutationCtx, mc: Actor, filmId: Id<"films">): Promise<{ film: Doc<"films">; row: Doc<"filmProgress"> } | { code: string }> {
  const film = await ctx.db.get(filmId);
  if (!film || film.status !== "approved") return { code: "not_found" };
  let row = await ctx.db.query("filmProgress").withIndex("by_memberId_and_filmId", (q) => q.eq("memberId", mc.member._id).eq("filmId", filmId)).first();
  if (!row) {
    const id = await ctx.db.insert("filmProgress", {
      memberId: mc.member._id,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      filmId,
      furthestSec: 0,
      scored: false,
    });
    row = (await ctx.db.get(id))!;
  }
  return { film, row };
}

// A short play link, and where to resume from. The host reference never leaves the server except as the link.
export const playLink = mutation({
  args: { filmId: v.id("films") },
  returns: v.union(v.object({ ok: v.literal(true), url: v.string(), expiresAt: v.number(), furthestSec: v.number(), kept: v.boolean() }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "filmCall", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    const found = await filmAndProgress(ctx, mc, args.filmId);
    if ("code" in found) return { ok: false as const, code: found.code };
    const link = playUrlOf(found.film.hostRef);
    if (!link.ok) return { ok: false as const, code: link.code };
    return { ok: true as const, url: link.url, expiresAt: Date.now() + LINK_TTL_MS, furthestSec: found.row.scored ? found.film.durationSec : found.row.furthestSec, kept: found.row.scored };
  },
});

// The student's browser reports how far they have watched. The server raises its own record only as far as real time allows.
export const progress = mutation({
  args: { filmId: v.id("films"), seconds: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), furthestSec: v.number(), kept: v.boolean() }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "filmCall", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    const found = await filmAndProgress(ctx, mc, args.filmId);
    if ("code" in found) return { ok: false as const, code: found.code };
    const { film, row } = found;
    if (row.scored) return { ok: true as const, furthestSec: film.durationSec, kept: true };
    const now = Date.now();
    const next = progressAfter({ furthest: row.furthestSec, lastAt: row.lastAt, now, reported: args.seconds, durationSec: film.durationSec });
    if (next.accepted) await ctx.db.patch(row._id, { furthestSec: next.furthest, lastAt: now });
    return { ok: true as const, furthestSec: next.furthest, kept: false };
  },
});

// The film reached its end. The score is written once, and only when the server's own record shows the film was watched to the end. A replay
// writes nothing. One `modules.kept` event is written the first time (the category only).
export const finish = mutation({
  args: { filmId: v.id("films"), seconds: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), score: v.number(), first: v.boolean() }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "filmCall", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    const found = await filmAndProgress(ctx, mc, args.filmId);
    if ("code" in found) return { ok: false as const, code: found.code };
    const { film, row } = found;
    if (row.scored) return { ok: true as const, score: film.scoreValue, first: false };
    const now = Date.now();
    const next = progressAfter({ furthest: row.furthestSec, lastAt: row.lastAt, now, reported: args.seconds, durationSec: film.durationSec, ignoreInterval: true });
    if (!reachedEnd(next.furthest, film.durationSec)) {
      if (next.accepted) await ctx.db.patch(row._id, { furthestSec: next.furthest, lastAt: now });
      return { ok: false as const, code: "not_finished" };
    }
    await ctx.db.patch(row._id, { furthestSec: film.durationSec, lastAt: now, scored: true, scoredAt: now });
    await recordEvent(ctx, {
      by: mc,
      memberId: mc.member._id,
      room: "modules",
      type: "modules.kept",
      payload: { category: film.category },
      occurredAt: now,
      eventKey: `film:${row._id}-0`,
      about: `film:${row._id}`,
    });
    return { ok: true as const, score: film.scoreValue, first: true };
  },
});
