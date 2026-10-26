// The DHI desk (spec house/0016): the student's coins, saved talks and the rules around a question. This file has no model call; the call itself is
// `deskAsk.ask` (an action), which asks `begin` here first, then `finish` or `abandon`. A question takes its coins in the same step that stores it, so
// the balance can never go below zero and a race cannot spend a coin twice. A repeated question is answered from `deskCache` for 0 coins and no model call.
// A message that looks like distress is answered with the care text by the screen: nothing is stored, no coins are taken and the model is never called.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { env, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { dayOf } from "./dayRules";
import {
  CACHE_DAYS,
  DEFAULT_MONTHLY_COINS,
  MAX_MONTHLY_COINS,
  PENDING_STALE_MS,
  PRICES,
  THREADS_SHOWN,
  answerMaxFor,
  cacheKeyOf,
  cleanQuestion,
  isDeskKind,
  isLiveKind,
  looksDistressed,
  looksPersonal,
  titleOf,
} from "./deskRules";
import { touchSitting } from "./deskSitting";
import { fail } from "./helpers";
import { requireDhiAdmin, requireMember } from "./houseAuth";
import { rateLimiter } from "./limits";

const MAX_TURNS_IN_THREAD = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const refused = v.object({ ok: v.literal(false), code: v.string() });

// The desk answers only when the owner has switched it on and a model key is set on this deployment. The key is never read by a query or sent anywhere
// but the model.
export function deskReady(e: { DESK_LIVE?: string; OPENAI_API_KEY?: string }): boolean {
  const live = (e.DESK_LIVE ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(live) && (e.OPENAI_API_KEY ?? "").trim().length > 0;
}

async function monthlyCoins(ctx: Pick<MutationCtx, "db">): Promise<number> {
  const row = await ctx.db.query("deskSettings").first();
  return row ? row.monthlyCoins : DEFAULT_MONTHLY_COINS;
}

// The student's wallet, made at the first visit and topped up once a month. The month is the India month of the house day, and unused coins roll over.
async function walletFor(ctx: MutationCtx, member: Doc<"members">, now: number): Promise<Doc<"deskWallets">> {
  const month = dayOf(now).slice(0, 7);
  const coins = await monthlyCoins(ctx);
  const row = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).first();
  if (!row) {
    const id = await ctx.db.insert("deskWallets", {
      memberId: member._id,
      instituteId: member.instituteId as NonNullable<typeof member.instituteId>,
      balance: coins,
      grantedMonth: month,
    });
    return (await ctx.db.get(id)) as Doc<"deskWallets">;
  }
  if (row.grantedMonth < month) {
    await ctx.db.patch(row._id, { balance: row.balance + coins, grantedMonth: month });
    return { ...row, balance: row.balance + coins, grantedMonth: month };
  }
  return row;
}

// What the screen needs to start: it makes the wallet and adds the month's coins, then the reactive `wallet` query shows the balance.
export const open = mutation({
  args: {},
  returns: v.object({ balance: v.number() }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const wallet = await walletFor(ctx, mc.member, Date.now());
    return { balance: wallet.balance };
  },
});

export const wallet = query({
  args: {},
  returns: v.object({ balance: v.number(), live: v.boolean(), prices: v.object({ chat: v.number(), clarify: v.number() }) }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const row = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).first();
    const start = row ? row.balance : (await ctx.db.query("deskSettings").first())?.monthlyCoins ?? DEFAULT_MONTHLY_COINS;
    return { balance: start, live: deskReady(env), prices: { chat: PRICES.chat, clarify: PRICES.clarify } };
  },
});

export const threads = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), title: v.string(), lastAt: v.number() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const rows = await ctx.db.query("deskThreads").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", mc.member._id)).order("desc").take(THREADS_SHOWN);
    return rows.map((r) => ({ id: r._id as string, title: r.title, lastAt: r.lastAt }));
  },
});

const turnView = v.object({
  id: v.string(),
  kind: v.string(),
  question: v.string(),
  answer: v.union(v.string(), v.null()),
  status: v.string(),
  coinsSpent: v.number(),
  cached: v.boolean(),
  createdAt: v.number(),
});

// One of the student's own talks, or null. A malformed id, a missing row and another student's talk read the same.
export const thread = query({
  args: { threadId: v.string() },
  returns: v.union(v.null(), v.object({ id: v.string(), title: v.string(), turns: v.array(turnView) })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const id = ctx.db.normalizeId("deskThreads", args.threadId);
    const t = id ? await ctx.db.get(id) : null;
    if (!t || t.memberId !== mc.member._id) return null;
    const turns = await ctx.db.query("deskTurns").withIndex("by_threadId", (q) => q.eq("threadId", t._id)).take(MAX_TURNS_IN_THREAD);
    return {
      id: t._id as string,
      title: t.title,
      turns: turns.map((x) => ({
        id: x._id as string,
        kind: x.kind,
        question: x.question,
        answer: x.answer ?? null,
        status: x.status,
        coinsSpent: x.coinsSpent,
        cached: x.cached,
        createdAt: x.createdAt,
      })),
    };
  },
});

// The student deletes one of their own talks and everything in it.
export const removeThread = mutation({
  args: { threadId: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const id = ctx.db.normalizeId("deskThreads", args.threadId);
    const t = id ? await ctx.db.get(id) : null;
    if (!t || t.memberId !== mc.member._id) return { ok: false as const, code: "not_found" };
    const turns = await ctx.db.query("deskTurns").withIndex("by_threadId", (q) => q.eq("threadId", t._id)).take(MAX_TURNS_IN_THREAD + 1);
    // A question still waiting keeps its coins reserved; return them with the talk so deleting never costs a coin.
    for (const x of turns) {
      if (x.status === "pending") await refund(ctx, x);
      await ctx.db.delete("deskTurns", x._id);
    }
    await ctx.db.delete("deskThreads", t._id);
    return { ok: true as const };
  },
});

// What DHI admin sees on the desk's staff screen: the coins every student gets each month, and when it was last set (null while nobody has set it).
export const allotment = query({
  args: {},
  returns: v.object({ monthlyCoins: v.number(), updatedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    await requireDhiAdmin(ctx);
    const row = await ctx.db.query("deskSettings").first();
    return { monthlyCoins: row ? row.monthlyCoins : DEFAULT_MONTHLY_COINS, updatedAt: row ? row.updatedAt : null };
  },
});

// DHI admin sets the coins every student gets each month. An institute admin, a teacher and a student are refused by `requireDhiAdmin`.
export const allot = mutation({
  args: { monthlyCoins: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), monthlyCoins: v.number() }), refused),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    if (!Number.isInteger(args.monthlyCoins) || args.monthlyCoins < 0 || args.monthlyCoins > MAX_MONTHLY_COINS) return { ok: false as const, code: "bad_amount" };
    const row = await ctx.db.query("deskSettings").first();
    if (row) await ctx.db.patch(row._id, { monthlyCoins: args.monthlyCoins, setBy: mc.member._id, updatedAt: Date.now() });
    else await ctx.db.insert("deskSettings", { monthlyCoins: args.monthlyCoins, setBy: mc.member._id, updatedAt: Date.now() });
    return { ok: true as const, monthlyCoins: args.monthlyCoins };
  },
});

// The coins of a turn go back to the wallet and the turn is marked failed. Idempotent: a turn that is not pending is left alone.
async function refund(ctx: MutationCtx, turn: Doc<"deskTurns">): Promise<number | null> {
  const w = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", turn.memberId)).first();
  if (turn.status !== "pending") return w ? w.balance : null;
  if (w && turn.coinsSpent > 0) await ctx.db.patch(w._id, { balance: w.balance + turn.coinsSpent });
  await ctx.db.patch(turn._id, { status: "failed", coinsSpent: 0 });
  return w ? w.balance + turn.coinsSpent : null;
}

const beginResult = v.union(
  refused,
  v.object({ ok: v.literal(true), mode: v.literal("care") }),
  v.object({ ok: v.literal(true), mode: v.literal("cached"), threadId: v.string(), turnId: v.string(), answer: v.string(), balance: v.number() }),
  v.object({
    ok: v.literal(true),
    mode: v.literal("model"),
    threadId: v.string(),
    turnId: v.string(),
    balance: v.number(),
    kind: v.string(),
    question: v.string(),
    earlier: v.union(v.null(), v.object({ question: v.string(), answer: v.string() })),
  }),
);

// Step one of a question, internal: the entry check, the limits, the exam lock, the care check, the cache and the coins. The order is: the desk being
// switched on, the entry check and the role, the hourly limits (every attempt counts), the question's own checks, the exam lock, the care check,
// the talk, the cache (before the coins, so a stored answer is free even at 0), the coins, then the write.
export const begin = internalMutation({
  args: { threadId: v.optional(v.string()), kind: v.string(), question: v.string() },
  returns: beginResult,
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const member = mc.member;
    if (!isDeskKind(args.kind)) return { ok: false as const, code: "bad_kind" };
    if (!isLiveKind(args.kind)) return { ok: false as const, code: "not_open_yet" };
    if (!deskReady(env)) return { ok: false as const, code: "model_not_chosen" };
    const kind = args.kind;

    const asks = await rateLimiter.limit(ctx, "deskAsk", { key: member._id });
    if (!asks.ok) return { ok: false as const, code: "rate_limited" };
    if (kind === "clarify") {
      const free = await rateLimiter.limit(ctx, "deskClarify", { key: member._id });
      if (!free.ok) return { ok: false as const, code: "rate_limited" };
    }
    const question = cleanQuestion(args.question, kind);
    if (!question) return { ok: false as const, code: "bad_question" };

    // The exam lock (Desk Design rule 5): while a paper is open for this student the desk is closed, so it can never answer a paper.
    const attempts = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).take(200);
    if (attempts.some((a) => a.status === "open")) return { ok: false as const, code: "exam_open" };

    // Feelings are not handled by the model (rule 6): nothing is stored, no coins are taken and no model is called.
    if (looksDistressed(question)) return { ok: true as const, mode: "care" as const };

    const now = Date.now();
    let existing: Doc<"deskThreads"> | null = null;
    if (args.threadId !== undefined) {
      const id = ctx.db.normalizeId("deskThreads", args.threadId);
      const t = id ? await ctx.db.get(id) : null;
      if (!t || t.memberId !== member._id) return { ok: false as const, code: "not_found" };
      existing = t;
    }
    let earlier: { question: string; answer: string } | null = null;
    if (existing) {
      const turns = await ctx.db.query("deskTurns").withIndex("by_threadId", (q) => q.eq("threadId", (existing as Doc<"deskThreads">)._id)).order("desc").take(MAX_TURNS_IN_THREAD);
      if (turns.length >= MAX_TURNS_IN_THREAD) return { ok: false as const, code: "thread_full" };
      const last = turns.find((x) => x.status === "answered" && x.answer !== undefined);
      if (last) earlier = { question: last.question, answer: last.answer as string };
    }
    // A clarifying question needs something to clarify.
    if (kind === "clarify" && !earlier) return { ok: false as const, code: "nothing_to_clarify" };

    const wallet = await walletFor(ctx, member, now);
    const instituteId = member.instituteId as NonNullable<typeof member.instituteId>;

    // The cache (a repeated question). Only a stand alone chat question is stored and reused; a clarifying question depends on its talk.
    const key = cacheKeyOf(kind, question);
    if (kind === "chat" && !looksPersonal(question)) {
      const hit = await ctx.db.query("deskCache").withIndex("by_instituteId_and_key", (q) => q.eq("instituteId", instituteId).eq("key", key)).first();
      if (hit && now - hit.createdAt <= CACHE_DAYS * DAY_MS) {
        const threadId = existing?._id ?? (await ctx.db.insert("deskThreads", { memberId: member._id, instituteId, title: titleOf(question), lastAt: now }));
        if (existing) await ctx.db.patch(existing._id, { lastAt: now });
        const turnId = await ctx.db.insert("deskTurns", {
          threadId,
          memberId: member._id,
          instituteId,
          kind,
          question,
          answer: hit.answer,
          status: "answered",
          coinsSpent: 0,
          cached: true,
          createdAt: now,
        });
        await ctx.db.patch(hit._id, { hits: hit.hits + 1 });
        await touchSitting(ctx, member, now, kind);
        return { ok: true as const, mode: "cached" as const, threadId: threadId as string, turnId: turnId as string, answer: hit.answer, balance: wallet.balance };
      }
    }

    const price = PRICES[kind];
    if (wallet.balance < price) return { ok: false as const, code: "not_enough_coins" };
    const threadId = existing?._id ?? (await ctx.db.insert("deskThreads", { memberId: member._id, instituteId, title: titleOf(question), lastAt: now }));
    if (existing) await ctx.db.patch(existing._id, { lastAt: now });
    if (price > 0) await ctx.db.patch(wallet._id, { balance: wallet.balance - price });
    const turnId = await ctx.db.insert("deskTurns", {
      threadId,
      memberId: member._id,
      instituteId,
      kind,
      question,
      status: "pending",
      coinsSpent: price,
      cached: false,
      createdAt: now,
    });
    await touchSitting(ctx, member, now, kind);
    // A clarifying question carries the talk's last answered turn so the model knows what is being clarified; a chat question carries nothing else.
    return {
      ok: true as const,
      mode: "model" as const,
      threadId: threadId as string,
      turnId: turnId as string,
      balance: wallet.balance - price,
      kind,
      question,
      earlier: kind === "clarify" ? earlier : null,
    };
  },
});

// Step two when the model answered: the answer is kept on the turn with its cost, and a stand alone chat answer is stored for the next student who asks
// the same thing in this institute. A turn the sweep already gave up on is not answered late.
export const finish = internalMutation({
  args: { turnId: v.string(), answer: v.string(), model: v.string(), tokensIn: v.number(), tokensOut: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), balance: v.number() }), refused),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("deskTurns", args.turnId);
    const turn = id ? await ctx.db.get(id) : null;
    if (!turn) return { ok: false as const, code: "not_found" };
    if (turn.status !== "pending") return { ok: false as const, code: "expired" };
    const answer = args.answer.slice(0, answerMaxFor(turn.kind));
    await ctx.db.patch(turn._id, { status: "answered", answer, model: args.model, tokensIn: args.tokensIn, tokensOut: args.tokensOut });
    if (turn.kind === "chat" && !looksPersonal(turn.question)) {
      const key = cacheKeyOf("chat", turn.question);
      const row = await ctx.db.query("deskCache").withIndex("by_instituteId_and_key", (q) => q.eq("instituteId", turn.instituteId).eq("key", key)).first();
      const now = Date.now();
      if (row) await ctx.db.patch(row._id, { answer, createdAt: now });
      else await ctx.db.insert("deskCache", { instituteId: turn.instituteId, key, answer, hits: 0, createdAt: now });
    }
    const w = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", turn.memberId)).first();
    return { ok: true as const, balance: w ? w.balance : 0 };
  },
});

// Step two when the model failed: the coins go back and the turn is marked failed. Safe to call twice.
export const abandon = internalMutation({
  args: { turnId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("deskTurns", args.turnId);
    const turn = id ? await ctx.db.get(id) : null;
    if (turn) await refund(ctx, turn);
    return null;
  },
});

// The minute job: a question whose action died before it could answer or give up is given up here, and its coins go back.
export const sweepPending = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("deskTurns")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending").lt("createdAt", Date.now() - PENDING_STALE_MS))
      .take(100);
    for (const t of old) await refund(ctx, t);
    return old.length;
  },
});
