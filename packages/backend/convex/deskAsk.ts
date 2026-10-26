// The DHI desk's one model gateway (spec house/0016; Desk Design rule 7). `ask` is the only place a model is called. It asks `desk.begin` first (the
// entry check, the limits, the exam lock, the cache and the coins), calls the model only on a miss, and then keeps the answer (`desk.finish`) or returns
// the coins (`desk.abandon`). The model receives the instruction and the student's typed question, and for a clarifying question the talk's last
// question and answer: never a name, a class or another student's data. The key is read from the deployment's environment and goes nowhere else.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env } from "./_generated/server";
import { answerMaxFor, cleanSvg, maxTokensFor, systemPromptFor, userTextFor } from "./deskRules";

const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 60 * 1000; // under the sweep's 2 minutes, so a late answer never meets a turn that was already given up

const refused = v.object({ ok: v.literal(false), code: v.string() });
const answered = v.object({
  ok: v.literal(true),
  threadId: v.string(),
  turnId: v.string(),
  answer: v.union(v.string(), v.null()),
  care: v.boolean(),
  cached: v.boolean(),
  balance: v.union(v.number(), v.null()),
});

type Message = { role: "system" | "user" | "assistant"; content: string };
// What `desk.begin` and `desk.finish` return, written out here so this file's own type does not depend on its own references (the circularity note in the Convex guidelines).
type Begin =
  | { ok: false; code: string }
  | { ok: true; mode: "care" }
  | { ok: true; mode: "cached"; threadId: string; turnId: string; answer: string; balance: number }
  | { ok: true; mode: "model"; threadId: string; turnId: string; balance: number; kind: string; question: string; earlier: { question: string; answer: string } | null };
type Finish = { ok: true; balance: number } | { ok: false; code: string };
type Reply = { ok: false; code: string } | { ok: true; threadId: string; turnId: string; answer: string | null; care: boolean; cached: boolean; balance: number | null };
type ModelReply = { answer: string; tokensIn: number; tokensOut: number } | null;

// One call to the model. Any failure (no key, a timeout, a refusal from the provider, an empty or odd reply) is null, and the caller returns the coins.
async function callModel(model: string, messages: Message[], maxTokens: number): Promise<ModelReply> {
  const key = (env.OPENAI_API_KEY ?? "").trim();
  if (!key) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const choice = (body as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
    if (typeof choice !== "string" || choice.trim().length === 0) return null;
    const usage = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
    return { answer: choice.trim(), tokensIn: n(usage?.prompt_tokens), tokensOut: n(usage?.completion_tokens) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// A student asks the desk. `threadId` continues one of their own talks; leaving it out starts a new one. `kind` is `chat` (1 coin), `write` (2 coins, up to 1500 letters) or `paper` (2 coins, a topic) or `mock` (4 coins, a topic, ten questions) or `story` (5 coins, a topic) or `draw` (8 coins, a topic, a checked svg diagram; none of these is
// cached) or `clarify` (free, inside a talk that has an answer). Expected refusals are returned, never thrown, so the hourly limit keeps its count.
export const ask = action({
  args: { threadId: v.optional(v.string()), kind: v.string(), question: v.string() },
  returns: v.union(refused, answered),
  handler: async (ctx, args): Promise<Reply> => {
    const start: Begin = await ctx.runMutation(internal.desk.begin, args);
    if (!start.ok) return start;
    if (start.mode === "care") return { ok: true as const, threadId: "", turnId: "", answer: null, care: true, cached: false, balance: null };
    if (start.mode === "cached") {
      return { ok: true as const, threadId: start.threadId, turnId: start.turnId, answer: start.answer, care: false, cached: true, balance: start.balance };
    }
    const model = (env.DESK_MODEL ?? "").trim() || DEFAULT_MODEL;
    const messages: Message[] = [{ role: "system", content: systemPromptFor(start.kind) }];
    if (start.earlier) {
      messages.push({ role: "user", content: start.earlier.question }, { role: "assistant", content: start.earlier.answer });
    }
    messages.push({ role: "user", content: userTextFor(start.kind, start.question) });
    const reply = await callModel(model, messages, maxTokensFor(start.kind));
    // A diagram is kept only after it passes the svg check; one that does not is a failure like any other, and the coins go back.
    const text = reply && start.kind === "draw" ? cleanSvg(reply.answer) : (reply?.answer ?? null);
    if (!reply || text === null) {
      await ctx.runMutation(internal.desk.abandon, { turnId: start.turnId });
      return { ok: false as const, code: "model_failed" };
    }
    const done: Finish = await ctx.runMutation(internal.desk.finish, { turnId: start.turnId, answer: text, model, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut });
    if (!done.ok) return done;
    return { ok: true as const, threadId: start.threadId, turnId: start.turnId, answer: text.slice(0, answerMaxFor(start.kind)), care: false, cached: false, balance: done.balance };
  },
});
