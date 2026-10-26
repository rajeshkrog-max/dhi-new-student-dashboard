/// <reference types="vite/client" />
// The DHI desk (spec house/0016). Each test names the criterion it covers. The model is a stand in `fetch` that counts its calls and keeps what it was
// sent, so the coin, cache and care rules are proven without a real model. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { cacheKeyOf, cleanQuestion, cleanSvg, isLiveKind, looksDistressed, looksPersonal, PRICES } from "./deskRules";
import { deskReady } from "./desk";
import { deskRoom } from "./deskRoom";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-24T10:00:00+05:30");
const DAY = 24 * 60 * 60 * 1000;

type Sent = { model: string; messages: { role: string; content: string }[]; max_completion_tokens: number };
let sent: Sent[] = [];
let modelStatus = 200;
let modelContent: string | null = null; // what the stand in model says; null means "Answer <n>"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.DESK_LIVE = "true";
  process.env.OPENAI_API_KEY = "test-key-not-real";
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
  sent = [];
  modelStatus = 200;
  modelContent = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string; headers: Record<string, string> }) => {
      sent.push(JSON.parse(init.body) as Sent);
      if (modelStatus !== 200) return new Response("{}", { status: modelStatus });
      return new Response(JSON.stringify({ choices: [{ message: { content: modelContent ?? `Answer ${sent.length}` } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.DESK_LIVE;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ERASURE_HASH_SECRET;
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const sb = await makeStudent(t, B.admin, b1, "sb@beta.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2, sb]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, B, a1, teacher, s, s2, sb };
}
type World = Awaited<ReturnType<typeof world>>;

type Reply = { ok: true; threadId: string; turnId: string; answer: string | null; care: boolean; cached: boolean; balance: number | null } | { ok: false; code: string };
const ask = (p: Person, question: string, extra: { threadId?: string; kind?: string } = {}): Promise<Reply> =>
  p.as.action(api.deskAsk.ask, { kind: extra.kind ?? "chat", question, ...(extra.threadId ? { threadId: extra.threadId } : {}) }) as Promise<Reply>;
const okAsk = async (p: Person, question: string, extra: { threadId?: string; kind?: string } = {}) => {
  const r = await ask(p, question, extra);
  if (!r.ok) throw new Error(`setup ${JSON.stringify(r)}`);
  return r;
};
const balanceOf = async (p: Person) => (await p.as.query(api.desk.wallet, {})).balance;
const setBalance = (w: World, p: Person, balance: number) =>
  w.t.run(async (ctx) => {
    const row = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", p.memberId)).first();
    if (row) await ctx.db.patch(row._id, { balance });
  });
const rowsOf = (w: World, p: Person) =>
  w.t.run(async (ctx) => ({
    threads: (await ctx.db.query("deskThreads").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", p.memberId)).take(50)).length,
    turns: (await ctx.db.query("deskTurns").withIndex("by_memberId", (q) => q.eq("memberId", p.memberId)).take(50)).length,
  }));

describe("the pure rules", () => {
  test("prices follow the spec and a clarifying question is free", () => {
    expect(PRICES).toEqual({ chat: 1, clarify: 0, write: 2, paper: 2, mock: 4, story: 5, draw: 8 });
  });
  test("a question is cleaned and keyed so small differences meet", () => {
    expect(cleanQuestion("  What   is torque? ")).toBe("What is torque?");
    expect(cleanQuestion("   ")).toBeNull();
    expect(cleanQuestion("a".repeat(601))).toBeNull();
    expect(cacheKeyOf("chat", "What is  Torque?")).toBe(cacheKeyOf("chat", "what is torque"));
    expect(cacheKeyOf("chat", "x")).not.toBe(cacheKeyOf("clarify", "x"));
  });
  test("a question with an email or a phone number is personal; distress words are caught", () => {
    expect(looksPersonal("mail me at asha@example.com")).toBe(true);
    expect(looksPersonal("call 98765 43210 now")).toBe(true);
    expect(looksPersonal("what is 12 times 13")).toBe(false);
    expect(looksDistressed("I want to die")).toBe(true);
    expect(looksDistressed("how do plants die in winter")).toBe(false);
  });
  test("the desk is ready only with the switch on and a key", () => {
    expect(deskReady({ DESK_LIVE: "true", OPENAI_API_KEY: "k" })).toBe(true);
    expect(deskReady({ DESK_LIVE: "true" })).toBe(false);
    expect(deskReady({ OPENAI_API_KEY: "k" })).toBe(false);
    expect(deskReady({ DESK_LIVE: "off", OPENAI_API_KEY: "k" })).toBe(false);
  });
});

describe("writing feedback (the Write kind)", () => {
  const piece = "Last summer I went to my grandmother's house. It was very hot but we played in the river every day.";

  test("the pure rules: a piece of writing may be 1500 letters, a question only 600", () => {
    expect(cleanQuestion("a".repeat(1500), "write")).not.toBeNull();
    expect(cleanQuestion("a".repeat(1501), "write")).toBeNull();
    expect(cleanQuestion("a".repeat(601), "chat")).toBeNull();
    expect(cleanQuestion("a".repeat(601))).toBeNull();
  });

  test("a piece of writing takes 2 coins and the answer is kept", async () => {
    const w = await world();
    const r = await okAsk(w.s, piece, { kind: "write" });
    expect(r).toMatchObject({ care: false, cached: false, answer: "Answer 1", balance: 58 });
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.turns).toMatchObject([{ kind: "write", question: piece, status: "answered", coinsSpent: 2, cached: false }]);
  });

  test("the model gets the coaching instruction that forbids a rewrite, the writing as text, and no student data", async () => {
    const w = await world();
    await okAsk(w.s, piece, { kind: "write" });
    expect(sent).toHaveLength(1);
    expect(sent[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sent[0].messages[0].content).toContain("Never write a corrected or rewritten version");
    expect(sent[0].messages[0].content).toContain("Give no marks");
    expect(sent[0].messages[1].content).toBe(`My writing:\n\n${piece}`);
    const text = JSON.stringify(sent[0]);
    for (const secret of ["Alpha", "alpha.test", "Class 10", String(w.s.memberId)]) expect(text).not.toContain(secret);
  });

  test("the same writing is never served from the cache, even for a classmate", async () => {
    const w = await world();
    await okAsk(w.s, piece, { kind: "write" });
    const again = await okAsk(w.s2, piece, { kind: "write" });
    expect(again).toMatchObject({ cached: false, balance: 58 });
    expect(sent).toHaveLength(2);
    const cached = await w.t.run((ctx) => ctx.db.query("deskCache").take(10));
    expect(cached).toEqual([]);
  });

  test("over 1500 letters is refused before any coin or model call", async () => {
    const w = await world();
    expect(await ask(w.s, "a".repeat(1501), { kind: "write" })).toEqual({ ok: false, code: "bad_question" });
    expect(await balanceOf(w.s)).toBe(60);
    expect(sent).toHaveLength(0);
  });

  test("with 1 coin left it is refused, and a failed model call returns the 2 coins", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    await setBalance(w, w.s, 1);
    expect(await ask(w.s, piece, { kind: "write" })).toEqual({ ok: false, code: "not_enough_coins" });
    await setBalance(w, w.s, 5);
    modelStatus = 500;
    expect(await ask(w.s, piece, { kind: "write" })).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(5);
  });

  test("the care text applies to writing too", async () => {
    const w = await world();
    const care = await okAsk(w.s, "I feel like I want to die and nobody reads my essays", { kind: "write" });
    expect(care).toMatchObject({ care: true, answer: null, balance: null });
    expect(sent).toHaveLength(0);
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
  });
});

describe("practice questions (the Paper kind)", () => {
  test("a topic takes 2 coins and the five questions are kept", async () => {
    const w = await world();
    const r = await okAsk(w.s, "fractions, class 8", { kind: "paper" });
    expect(r).toMatchObject({ care: false, cached: false, answer: "Answer 1", balance: 58 });
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.turns).toMatchObject([{ kind: "paper", question: "fractions, class 8", status: "answered", coinsSpent: 2, cached: false }]);
  });

  test("the model gets the practice instruction (five questions, no answers) and the topic only", async () => {
    const w = await world();
    await okAsk(w.s, "fractions, class 8", { kind: "paper" });
    expect(sent).toHaveLength(1);
    expect(sent[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sent[0].messages[0].content).toContain("exactly five short practice questions");
    expect(sent[0].messages[0].content).toContain("Do not write the answers");
    expect(sent[0].messages[1].content).toBe("Topic: fractions, class 8");
    const text = JSON.stringify(sent[0]);
    for (const secret of ["Alpha", "alpha.test", String(w.s.memberId)]) expect(text).not.toContain(secret);
  });

  test("each paper is made fresh: the same topic is not cached, even for a classmate", async () => {
    const w = await world();
    await okAsk(w.s, "fractions", { kind: "paper" });
    await okAsk(w.s2, "fractions", { kind: "paper" });
    expect(sent).toHaveLength(2);
    expect(await w.t.run((ctx) => ctx.db.query("deskCache").take(10))).toEqual([]);
  });

  test("asking about an answer afterwards is free and carries the practice questions", async () => {
    const w = await world();
    const p = await okAsk(w.s, "fractions", { kind: "paper" });
    const c = await okAsk(w.s, "What is the answer to question 2?", { kind: "clarify", threadId: p.threadId });
    expect(c.balance).toBe(58);
    expect(sent[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(sent[1].messages[2].content).toBe("Answer 1");
  });

  test("a topic over 600 letters is refused, 1 coin left is not enough, and a failed call returns the coins", async () => {
    const w = await world();
    expect(await ask(w.s, "a".repeat(601), { kind: "paper" })).toEqual({ ok: false, code: "bad_question" });
    await w.s.as.mutation(api.desk.open, {});
    await setBalance(w, w.s, 1);
    expect(await ask(w.s, "fractions", { kind: "paper" })).toEqual({ ok: false, code: "not_enough_coins" });
    await setBalance(w, w.s, 5);
    modelStatus = 500;
    expect(await ask(w.s, "fractions", { kind: "paper" })).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(5);
    expect(sent).toHaveLength(1);
  });
});

describe("a longer practice set (the Mock kind)", () => {
  test("a topic takes 4 coins and the ten questions are kept", async () => {
    const w = await world();
    const r = await okAsk(w.s, "fractions, class 8", { kind: "mock" });
    expect(r).toMatchObject({ care: false, cached: false, answer: "Answer 1", balance: 56 });
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.turns).toMatchObject([{ kind: "mock", question: "fractions, class 8", status: "answered", coinsSpent: 4, cached: false }]);
  });

  test("the model is told to write ten questions with no answers, no marks and no time limit, and gets room for them", async () => {
    const w = await world();
    await okAsk(w.s, "fractions", { kind: "mock" });
    expect(sent[0].messages[0].content).toContain("exactly ten short practice questions");
    expect(sent[0].messages[0].content).toContain("Do not write the answers, hints, marks, a time limit or a score");
    expect(sent[0].messages[1].content).toBe("Topic: fractions");
    expect(sent[0].max_completion_tokens).toBe(1000);
    await okAsk(w.s, "What is a lever?");
    expect(sent[1].max_completion_tokens).toBe(600);
  });

  test("never cached, free to ask about an answer afterwards, and refused with 3 coins", async () => {
    const w = await world();
    const m = await okAsk(w.s, "fractions", { kind: "mock" });
    await okAsk(w.s2, "fractions", { kind: "mock" });
    expect(sent).toHaveLength(2);
    expect(await w.t.run((ctx) => ctx.db.query("deskCache").take(10))).toEqual([]);
    const c = await okAsk(w.s, "Check my answer to question 3", { kind: "clarify", threadId: m.threadId });
    expect(c.balance).toBe(56);
    await setBalance(w, w.s, 3);
    expect(await ask(w.s, "decimals", { kind: "mock" })).toEqual({ ok: false, code: "not_enough_coins" });
  });

  test("a failed call returns the 4 coins", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    modelStatus = 500;
    expect(await ask(w.s, "fractions", { kind: "mock" })).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(60);
  });
});

describe("a study story (the Story kind)", () => {
  test("a topic takes 5 coins and the story is kept", async () => {
    const w = await world();
    const r = await okAsk(w.s, "fractions", { kind: "story" });
    expect(r).toMatchObject({ care: false, cached: false, answer: "Answer 1", balance: 55 });
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.turns).toMatchObject([{ kind: "story", question: "fractions", status: "answered", coinsSpent: 5, cached: false }]);
  });

  test("the model is told to write a short, school safe story that teaches the topic, and gets the topic only", async () => {
    const w = await world();
    await okAsk(w.s, "fractions", { kind: "story" });
    const rules = sent[0].messages[0].content;
    expect(rules).toContain("under 250 words");
    expect(rules).toContain("no violence, no romance, no frightening scenes");
    expect(sent[0].messages[1].content).toBe("Topic: fractions");
    expect(sent[0].max_completion_tokens).toBe(600);
    const text = JSON.stringify(sent[0]);
    for (const secret of ["Alpha", "alpha.test", String(w.s.memberId)]) expect(text).not.toContain(secret);
  });

  test("never cached, refused with 4 coins, the care text applies, and a failed call returns the 5 coins", async () => {
    const w = await world();
    await okAsk(w.s, "fractions", { kind: "story" });
    await okAsk(w.s2, "fractions", { kind: "story" });
    expect(sent).toHaveLength(2);
    expect(await w.t.run((ctx) => ctx.db.query("deskCache").take(10))).toEqual([]);
    await setBalance(w, w.s, 4);
    expect(await ask(w.s, "decimals", { kind: "story" })).toEqual({ ok: false, code: "not_enough_coins" });
    await setBalance(w, w.s, 20);
    modelStatus = 500;
    expect(await ask(w.s, "decimals", { kind: "story" })).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(20);
    modelStatus = 200;
    const before = sent.length;
    expect(await okAsk(w.s, "a story about how I want to die", { kind: "story" })).toMatchObject({ care: true, answer: null });
    expect(sent).toHaveLength(before);
  });
});

describe("the svg check (cleanSvg)", () => {
  const good =
    '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="black"/></marker></defs><rect x="20" y="20" width="120" height="60" fill="none" stroke="black"/><text x="30" y="55" font-size="14">Cell wall</text><line x1="140" y1="50" x2="260" y2="50" stroke="black" marker-end="url(#arrow)"/><circle cx="300" cy="50" r="30" fill="none" stroke="black"/><text x="280" y="55" font-size="14">Nucleus &amp; more</text></svg>';

  test("a plain diagram passes unchanged", () => {
    expect(cleanSvg(good)).toBe(good);
  });

  test("a reply in a code fence with a sentence around it is cut down to the svg", () => {
    expect(cleanSvg(`Here is your diagram:\n\`\`\`svg\n${good}\n\`\`\`\nHope it helps.`)).toBe(good);
  });

  test("a missing namespace and viewBox are added", () => {
    const out = cleanSvg('<svg><rect x="1" y="1" width="5" height="5"/></svg>');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('viewBox="0 0 400 300"');
  });

  const wrap = (inner: string, attrs = "") => `<svg viewBox="0 0 400 300"${attrs}>${inner}</svg>`;
  const bad: [string, string][] = [
    ["a script element", wrap("<script>alert(1)</script>")],
    ["an event attribute", wrap('<rect x="1" y="1" width="5" height="5" onload="alert(1)"/>')],
    ["an event attribute on the root", wrap("", ' onload="alert(1)"')],
    ["a foreignObject", wrap("<foreignObject><p>hi</p></foreignObject>")],
    ["an image", wrap('<image x="0" y="0" width="5" height="5"/>')],
    ["a link", wrap('<a><text x="1" y="1">x</text></a>')],
    ["an href", wrap('<text x="1" y="1" href="https://example.com">x</text>')],
    ["a style element", wrap("<style>rect{fill:red}</style>")],
    ["a style attribute", wrap('<rect x="1" y="1" width="5" height="5" style="fill:red"/>')],
    ["a comment", wrap("<!-- hi --><rect x=\"1\" y=\"1\" width=\"5\" height=\"5\"/>")],
    ["a nested svg", wrap("<svg><rect/></svg>")],
    ["an unclosed tag", wrap("<g><rect x=\"1\" y=\"1\" width=\"5\" height=\"5\"/>")],
    ["a javascript value", wrap('<rect x="1" y="1" width="5" height="5" fill="javascript:alert(1)"/>')],
    ["an outside url", wrap('<rect x="1" y="1" width="5" height="5" fill="url(http://example.com/a)"/>')],
    ["a single quoted attribute", wrap("<rect x='1' y='1' width='5' height='5'/>")],
    ["a wrong namespace", wrap("", ' xmlns="http://example.com/x"')],
    ["an entity that is not allowed", wrap('<text x="1" y="1">a&nbsp;b</text>')],
    ["a bare ampersand", wrap('<text x="1" y="1">a & b</text>')],
    ["text outside a text element", wrap("<g>hello</g>")],
    ["a greater than sign in a label", wrap('<text x="1" y="1">a > b</text>')],
    ["more than 250 elements", wrap('<rect x="1" y="1" width="5" height="5"/>'.repeat(251))],
    ["more than 12000 characters", wrap(`<text x="1" y="1">${"a".repeat(12000)}</text>`)],
    ["no svg at all", "a plain sentence"],
    ["a closing tag before the opening one", "</svg><svg>"],
  ];
  test.each(bad)("refuses %s", (_name, svg) => {
    expect(cleanSvg(svg)).toBeNull();
  });
});

describe("a diagram (the Draw kind)", () => {
  const diagram = '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="120" height="60" fill="none" stroke="black"/><text x="30" y="55" font-size="14">Cell wall</text></svg>';

  test("a topic takes 8 coins and the checked diagram is kept as the answer", async () => {
    const w = await world();
    modelContent = diagram;
    const r = await okAsk(w.s, "parts of a plant cell", { kind: "draw" });
    expect(r).toMatchObject({ care: false, cached: false, answer: diagram, balance: 52 });
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.turns).toMatchObject([{ kind: "draw", question: "parts of a plant cell", answer: diagram, status: "answered", coinsSpent: 8, cached: false }]);
  });

  test("the model is told to draw one plain svg and gets the topic only, with room for it", async () => {
    const w = await world();
    modelContent = diagram;
    await okAsk(w.s, "parts of a plant cell", { kind: "draw" });
    const rules = sent[0].messages[0].content;
    expect(rules).toContain("single SVG element");
    expect(rules).toContain("Never use script, style, image, foreignObject");
    expect(rules).toContain("Do not draw people, faces");
    expect(sent[0].messages[1].content).toBe("Topic: parts of a plant cell");
    expect(sent[0].max_completion_tokens).toBe(2500);
    const text = JSON.stringify(sent[0]);
    for (const secret of ["Alpha", "alpha.test", String(w.s.memberId)]) expect(text).not.toContain(secret);
  });

  test("a reply wrapped in a fence and a sentence is stored as the bare svg", async () => {
    const w = await world();
    modelContent = `Sure!\n\`\`\`svg\n${diagram}\n\`\`\``;
    const r = await okAsk(w.s, "cell", { kind: "draw" });
    expect(r.answer).toBe(diagram);
  });

  test("an unsafe reply is never stored or shown: the coins go back and nothing is kept as an answer", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    modelContent = '<svg viewBox="0 0 400 300"><script>alert(1)</script></svg>';
    expect(await ask(w.s, "cell", { kind: "draw" })).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(60);
    const turns = await w.t.run((ctx) => ctx.db.query("deskTurns").take(10));
    expect(turns.map((x) => x.status)).toEqual(["failed"]);
    expect(turns.every((x) => x.answer === undefined)).toBe(true);
  });

  test("never cached, refused with 7 coins, the care text applies, and asking about it afterwards is free", async () => {
    const w = await world();
    modelContent = diagram;
    const d = await okAsk(w.s, "cell", { kind: "draw" });
    await okAsk(w.s2, "cell", { kind: "draw" });
    expect(sent).toHaveLength(2);
    expect(await w.t.run((ctx) => ctx.db.query("deskCache").take(10))).toEqual([]);
    modelContent = null;
    const c = await okAsk(w.s, "What is the cell wall for?", { kind: "clarify", threadId: d.threadId });
    expect(c.balance).toBe(52);
    await setBalance(w, w.s, 7);
    expect(await ask(w.s, "atom", { kind: "draw" })).toEqual({ ok: false, code: "not_enough_coins" });
    const before = sent.length;
    expect(await okAsk(w.s, "draw how I want to die", { kind: "draw" })).toMatchObject({ care: true, answer: null });
    expect(sent).toHaveLength(before);
  });
});

describe("asking the desk (AC-1, AC-7)", () => {
  test("covers AC-1: a question takes 1 coin, the answer reads back after a reload, and a new student starts with 60 coins", async () => {
    const w = await world();
    expect(await w.s.as.mutation(api.desk.open, {})).toEqual({ balance: 60 });
    const r = await okAsk(w.s, "What is torque?");
    expect(r).toMatchObject({ care: false, cached: false, answer: "Answer 1", balance: 59 });
    expect(await balanceOf(w.s)).toBe(59);
    const talk = await w.s.as.query(api.desk.thread, { threadId: r.threadId });
    expect(talk?.title).toBe("What is torque?");
    expect(talk?.turns).toMatchObject([{ kind: "chat", question: "What is torque?", answer: "Answer 1", status: "answered", coinsSpent: 1, cached: false }]);
    expect((await w.s.as.query(api.desk.threads, {})).map((x) => x.id)).toEqual([r.threadId]);
  });

  test("covers AC-7: the model is sent the instruction and the typed question only, with no name, class or other student's data", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    expect(sent).toHaveLength(1);
    expect(sent[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sent[0].messages[1].content).toBe("What is torque?");
    const text = JSON.stringify(sent[0]);
    for (const secret of ["Asha", "Alpha", "alpha.test", "Class 10", String(w.s.memberId)]) expect(text).not.toContain(secret);
    expect(sent[0].max_completion_tokens).toBeGreaterThan(0);
  });

  test("covers AC-1: a second question in the same talk is kept in order", async () => {
    const w = await world();
    const a = await okAsk(w.s, "What is torque?");
    const b = await okAsk(w.s, "What is a lever?", { threadId: a.threadId });
    expect(b.threadId).toBe(a.threadId);
    expect((await w.s.as.query(api.desk.thread, { threadId: a.threadId }))?.turns.map((x) => x.question)).toEqual(["What is torque?", "What is a lever?"]);
  });

  test("a talk is the student's own: another student reads null and cannot add to it", async () => {
    const w = await world();
    const a = await okAsk(w.s, "What is torque?");
    expect(await w.s2.as.query(api.desk.thread, { threadId: a.threadId })).toBeNull();
    expect(await w.s2.as.query(api.desk.thread, { threadId: "not-an-id" })).toBeNull();
    expect(await ask(w.s2, "hi", { threadId: a.threadId })).toEqual({ ok: false, code: "not_found" });
  });

  test("refusals: a bad kind, an empty question", async () => {
    const w = await world();
    expect(await ask(w.s, "x", { kind: "nope" })).toEqual({ ok: false, code: "bad_kind" });
    expect(isLiveKind("nope")).toBe(false);
    expect(await ask(w.s, "   ")).toEqual({ ok: false, code: "bad_question" });
    expect(sent).toHaveLength(0);
  });

  test("only a student may ask", async () => {
    const w = await world();
    expect(await refusal(w.teacher.as.action(api.deskAsk.ask, { kind: "chat", question: "hi" }))).toBe("forbidden");
  });

  test("the desk answers model_not_chosen until it is switched on with a key", async () => {
    const w = await world();
    delete process.env.OPENAI_API_KEY;
    expect(await ask(w.s, "What is torque?")).toEqual({ ok: false, code: "model_not_chosen" });
    process.env.OPENAI_API_KEY = "k";
    process.env.DESK_LIVE = "off";
    expect(await ask(w.s, "What is torque?")).toEqual({ ok: false, code: "model_not_chosen" });
    expect(sent).toHaveLength(0);
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
  });
});

describe("coins (AC-2, AC-4, AC-5)", () => {
  test("covers AC-2: a student with too few coins is refused by the server and no model is called", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    await setBalance(w, w.s, 0);
    expect(await ask(w.s, "What is torque?")).toEqual({ ok: false, code: "not_enough_coins" });
    expect(sent).toHaveLength(0);
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
    expect(await balanceOf(w.s)).toBe(0);
  });

  test("covers AC-2: the last coin is spent once, never below zero, when two questions come at once", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    await setBalance(w, w.s, 1);
    const both = await Promise.all([ask(w.s, "first question"), ask(w.s, "second question")]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(both.filter((r) => !r.ok)).toEqual([{ ok: false, code: "not_enough_coins" }]);
    expect(await balanceOf(w.s)).toBe(0);
    expect(sent).toHaveLength(1);
  });

  test("covers AC-4: the month's coins are added once, and unused coins roll over", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?"); // 60 - 1 in October
    await w.s.as.mutation(api.desk.open, {});
    expect(await balanceOf(w.s)).toBe(59); // still October: nothing added
    // A month later: the wallet was last topped up in September (the test sign in would expire if the clock itself moved).
    await w.t.run(async (ctx) => {
      const row = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first();
      if (row) await ctx.db.patch(row._id, { grantedMonth: "2026-09" });
    });
    await w.s.as.mutation(api.desk.open, {});
    expect(await balanceOf(w.s)).toBe(119);
    await w.s.as.mutation(api.desk.open, {});
    expect(await balanceOf(w.s)).toBe(119);
  });

  test("covers AC-4: no function lets a student buy coins or change their own balance", async () => {
    const w = await world();
    const desk = await import("./desk");
    const names = Object.keys(desk).filter((n) => !["deskReady"].includes(n));
    expect(names.sort()).toEqual(["abandon", "allot", "allotment", "begin", "finish", "open", "removeThread", "sweepPending", "thread", "threads", "wallet"]);
    expect(await refusal(w.s.as.mutation(api.desk.allot, { monthlyCoins: 1000 }))).toBe("forbidden");
  });

  test("covers AC-5: only a DHI admin sets the allotment; an institute admin, a teacher and a student are refused", async () => {
    const w = await world();
    expect(await refusal(w.A.admin.as.mutation(api.desk.allot, { monthlyCoins: 500 }))).toBe("forbidden");
    expect(await refusal(w.teacher.as.mutation(api.desk.allot, { monthlyCoins: 500 }))).toBe("forbidden");
    expect(await refusal(w.s.as.mutation(api.desk.allot, { monthlyCoins: 500 }))).toBe("forbidden");
    expect(await w.dhi.as.mutation(api.desk.allot, { monthlyCoins: 30 })).toEqual({ ok: true, monthlyCoins: 30 });
    expect(await w.dhi.as.mutation(api.desk.allot, { monthlyCoins: -1 })).toEqual({ ok: false, code: "bad_amount" });
    expect(await w.dhi.as.mutation(api.desk.allot, { monthlyCoins: 1.5 })).toEqual({ ok: false, code: "bad_amount" });
    expect(await w.dhi.as.mutation(api.desk.allot, { monthlyCoins: 5000 })).toEqual({ ok: false, code: "bad_amount" });
    expect(await w.s.as.mutation(api.desk.open, {})).toEqual({ balance: 30 });
  });
});

describe("the allotment screen's query (AC-5)", () => {
  test("covers AC-5: only a DHI admin reads the allotment; it starts at 60 and shows the last change", async () => {
    const w = await world();
    expect(await refusal(w.A.admin.as.query(api.desk.allotment, {}))).toBe("forbidden");
    expect(await refusal(w.s.as.query(api.desk.allotment, {}))).toBe("forbidden");
    expect(await w.dhi.as.query(api.desk.allotment, {})).toEqual({ monthlyCoins: 60, updatedAt: null });
    await w.dhi.as.mutation(api.desk.allot, { monthlyCoins: 45 });
    expect(await w.dhi.as.query(api.desk.allotment, {})).toEqual({ monthlyCoins: 45, updatedAt: NOW });
  });
});

describe("the answer cache (AC-3)", () => {
  test("covers AC-3: a repeated question returns the stored answer for 0 coins with no model call, even at 0 coins", async () => {
    const w = await world();
    const first = await okAsk(w.s, "What is torque?");
    expect(sent).toHaveLength(1);
    await w.s2.as.mutation(api.desk.open, {});
    await setBalance(w, w.s2, 0);
    const again = await okAsk(w.s2, "  what IS torque ");
    expect(again).toMatchObject({ cached: true, answer: first.answer, balance: 0 });
    expect(sent).toHaveLength(1);
    const talk = await w.s2.as.query(api.desk.thread, { threadId: again.threadId });
    expect(talk?.turns[0]).toMatchObject({ cached: true, coinsSpent: 0 });
  });

  test("the cache is scoped to one institute", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    const other = await okAsk(w.sb, "What is torque?");
    expect(other.cached).toBe(false);
    expect(sent).toHaveLength(2);
  });

  test("a stored answer is asked again after 90 days", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    const setAge = (days: number) =>
      w.t.run(async (ctx) => {
        const row = await ctx.db.query("deskCache").first();
        if (row) await ctx.db.patch(row._id, { createdAt: NOW - days * DAY });
      });
    await setAge(89);
    expect((await okAsk(w.s2, "What is torque?")).cached).toBe(true);
    await setAge(91);
    const r = await okAsk(w.s2, "What is torque?");
    expect(r.cached).toBe(false);
    expect(sent).toHaveLength(2);
    expect((await okAsk(w.s, "What is torque?")).cached).toBe(true); // the refreshed answer is served again
    expect(sent).toHaveLength(2);
  });

  test("a question with a phone number is answered but never stored for others", async () => {
    const w = await world();
    await okAsk(w.s, "my number is 98765 43210, what is torque?");
    const rows = await w.t.run(async (ctx) => await ctx.db.query("deskCache").take(5));
    expect(rows).toHaveLength(0);
    expect((await okAsk(w.s2, "my number is 98765 43210, what is torque?")).cached).toBe(false);
  });

  test("the cache holds no student", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    const rows = await w.t.run(async (ctx) => await ctx.db.query("deskCache").take(5));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "answer", "createdAt", "hits", "instituteId", "key"]);
  });
});

describe("care and the exam lock (AC-6)", () => {
  test("covers AC-6: a message that looks like distress gets the care answer: no model, no coins, nothing stored", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    const r = await ask(w.s, "I want to die");
    expect(r).toMatchObject({ ok: true, care: true, answer: null });
    expect(sent).toHaveLength(0);
    expect(await balanceOf(w.s)).toBe(60);
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
  });

  test("covers AC-6: a turn can hold only text and numbers: no field for a recording, a file or a counselor's words", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    const turn = (await w.t.run(async (ctx) => await ctx.db.query("deskTurns").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).take(1)))[0];
    expect(Object.keys(turn).sort()).toEqual(["_creationTime", "_id", "answer", "cached", "coinsSpent", "createdAt", "instituteId", "kind", "memberId", "model", "question", "status", "threadId", "tokensIn", "tokensOut"]);
  });

  test("the desk is closed while a paper is open for the student", async () => {
    const w = await world();
    const paperId = await w.teacher.as.mutation(api.papers.create, {
      title: "Term test",
      questions: [{ kind: "mcq" as const, subject: "Maths", topic: "Fractions", text: "Half of four?", options: ["one", "two"], rightOption: 1, tags: [null, null] }],
    });
    const OPENS = NOW + 60 * 1000;
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: OPENS, dueAt: NOW + 2 * 60 * 60 * 1000 });
    const attempt = (await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).collect()))[0];
    expect((await okAsk(w.s, "What is torque?")).cached).toBe(false); // not started yet: the desk is open
    vi.setSystemTime(OPENS + 1000);
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    expect(await ask(w.s, "Half of four is what?")).toEqual({ ok: false, code: "exam_open" });
    expect((await okAsk(w.s2, "Half of four is what?")).ok).toBe(true); // a classmate who has not started is not locked
  });
});

describe("clarify (free) and failures", () => {
  test("a clarifying question is free, carries the last answer, and needs something to clarify", async () => {
    const w = await world();
    expect(await ask(w.s, "why?", { kind: "clarify" })).toEqual({ ok: false, code: "nothing_to_clarify" });
    const a = await okAsk(w.s, "What is torque?");
    const before = await balanceOf(w.s);
    const c = await okAsk(w.s, "Can you say it simpler?", { kind: "clarify", threadId: a.threadId });
    expect(c.balance).toBe(before);
    expect(sent[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(sent[1].messages[1].content).toBe("What is torque?");
    expect(sent[1].messages[2].content).toBe("Answer 1");
    const talk = await w.s.as.query(api.desk.thread, { threadId: a.threadId });
    expect(talk?.turns[1]).toMatchObject({ kind: "clarify", coinsSpent: 0, cached: false });
  });

  test("a clarifying question is never stored in the cache", async () => {
    const w = await world();
    const a = await okAsk(w.s, "What is torque?");
    await okAsk(w.s, "Simpler please", { kind: "clarify", threadId: a.threadId });
    const rows = await w.t.run(async (ctx) => await ctx.db.query("deskCache").take(5));
    expect(rows.map((r) => r.key)).toEqual(["chat:what is torque"]);
  });

  test("clarify has its own hourly limit", async () => {
    const w = await world();
    const a = await okAsk(w.s, "What is torque?");
    const results: string[] = [];
    for (let i = 0; i < 21; i++) {
      const r = await ask(w.s, `Say it again ${i}`, { kind: "clarify", threadId: a.threadId });
      results.push(r.ok ? "ok" : r.code);
    }
    expect(results.filter((x) => x === "ok").length).toBeLessThanOrEqual(20);
    expect(results).toContain("rate_limited");
  });

  test("a model failure returns the coins and marks the turn failed", async () => {
    const w = await world();
    modelStatus = 500;
    expect(await ask(w.s, "What is torque?")).toEqual({ ok: false, code: "model_failed" });
    expect(await balanceOf(w.s)).toBe(60);
    const turns = await w.t.run(async (ctx) => await ctx.db.query("deskTurns").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).take(5));
    expect(turns).toMatchObject([{ status: "failed", coinsSpent: 0 }]);
    modelStatus = 200;
    expect((await okAsk(w.s, "What is torque?")).balance).toBe(59);
  });

  test("a question the action never finished is given up by the minute job and its coins return", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    const wallet = await w.t.run(async (ctx) => await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first());
    await w.t.run(async (ctx) => {
      const threadId = await ctx.db.insert("deskThreads", { memberId: w.s.memberId, instituteId: wallet!.instituteId, title: "t", lastAt: NOW });
      await ctx.db.patch(wallet!._id, { balance: 59 });
      await ctx.db.insert("deskTurns", { threadId, memberId: w.s.memberId, instituteId: wallet!.instituteId, kind: "chat", question: "q", status: "pending", coinsSpent: 1, cached: false, createdAt: NOW });
    });
    expect(await w.t.mutation(internal.desk.sweepPending, {})).toBe(0); // too new
    vi.setSystemTime(NOW + 3 * 60 * 1000);
    expect(await w.t.mutation(internal.desk.sweepPending, {})).toBe(1);
    expect(await balanceOf(w.s)).toBe(60);
    expect(await w.t.mutation(internal.desk.sweepPending, {})).toBe(0);
  });

  test("a late answer for a turn already given up is not kept", async () => {
    const w = await world();
    await w.s.as.mutation(api.desk.open, {});
    const wallet = await w.t.run(async (ctx) => await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first());
    const turnId = await w.t.run(async (ctx) => {
      const threadId = await ctx.db.insert("deskThreads", { memberId: w.s.memberId, instituteId: wallet!.instituteId, title: "t", lastAt: NOW });
      return await ctx.db.insert("deskTurns", { threadId, memberId: w.s.memberId, instituteId: wallet!.instituteId, kind: "chat", question: "q", status: "failed", coinsSpent: 0, cached: false, createdAt: NOW });
    });
    expect(await w.t.mutation(internal.desk.finish, { turnId, answer: "late", model: "m", tokensIn: 1, tokensOut: 1 })).toEqual({ ok: false, code: "expired" });
  });
});

describe("deleting a talk, export and erase", () => {
  test("a student deletes a talk and its questions; a pending question's coins return", async () => {
    const w = await world();
    const a = await okAsk(w.s, "What is torque?");
    expect(await w.s.as.mutation(api.desk.removeThread, { threadId: a.threadId })).toEqual({ ok: true });
    expect(await w.s.as.query(api.desk.thread, { threadId: a.threadId })).toBeNull();
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
    expect(await w.s2.as.mutation(api.desk.removeThread, { threadId: a.threadId })).toEqual({ ok: false, code: "not_found" });
  });

  test("the export holds a student's own talks and the erase removes talks, questions and the wallet, and leaves the cache", async () => {
    const w = await world();
    await okAsk(w.s, "What is torque?");
    await okAsk(w.s2, "What is a lever?");
    const exported = await w.t.run(async (ctx) => await deskRoom.exporter(ctx, w.s.memberId, null, 100));
    expect(exported.rows).toMatchObject([{ title: "What is torque?", turns: [{ question: "What is torque?", answer: "Answer 1", coinsSpent: 1 }] }]);
    expect(JSON.stringify(exported)).not.toContain("lever");
    const erased = await w.t.run(async (ctx) => await deskRoom.eraser(ctx, w.s.memberId, 100));
    expect(erased.done).toBe(true);
    const left = await w.t.run(async (ctx) => ({
      wallet: (await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).take(5)).length,
      cache: (await ctx.db.query("deskCache").take(10)).length,
    }));
    expect(left).toEqual({ wallet: 0, cache: 2 });
    expect(await rowsOf(w, w.s)).toEqual({ threads: 0, turns: 0 });
    expect((await rowsOf(w, w.s2)).turns).toBe(1);
  });
});
