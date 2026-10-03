/**
 * Desk store. Same shape as later POST /dhi/sit.
 * Cache hits never spend coins.
 */

import { uid } from "@/lib/dhi/id";
import { COSTS, STUDENT_ID, STORE_KEY, coinsLeft, type DeskKind, type DeskStore, type DeskThread } from "./schema";

export { COSTS, coinsLeft } from "./schema";

export const STARTERS = [
  { id: "draw", kind: "draw" as DeskKind, title: "Draw this", body: "Turn a line of the chapter into a picture I can keep." },
  { id: "story", kind: "story" as DeskKind, title: "Make it a story", body: "Tell the concept as a sitting under the tree." },
  { id: "mock", kind: "mock" as DeskKind, title: "Mock me", body: "Three kind questions. No scare. Just the sitting." },
  { id: "write", kind: "write" as DeskKind, title: "Help me write", body: "A quiet page. You write. DHI sits with the gaps." },
  { id: "paper", kind: "paper" as DeskKind, title: "Hard question", body: "Open a question from Shubham Raj’s biology paper." },
];

function now() {
  return new Date().toISOString();
}

function seed(): DeskStore {
  const leaf: DeskThread = {
    id: "th_leaf",
    title: "The leaf kitchen",
    kind: "draw",
    preview: "Chloroplast as a brass cooking room.",
    updatedAt: now(),
    canvas: {
      id: "cv_leaf",
      src: "/desk/leaf-kitchen.jpg",
      caption: "The kitchen is inside the green grain — sunlight in, sugar out.",
      cacheKey: "draw:leaf-kitchen",
    },
    messages: [
      { id: "m1", role: "student", kind: "draw", body: "Show me where the leaf cooks sugar.", coins: 0, cacheHit: false, createdAt: now() },
      { id: "m2", role: "dhi", kind: "clarify", body: "Before I draw — the leaf kitchen (chloroplast) or the cell’s hearth (mitochondria)?", coins: 0, cacheHit: false, createdAt: now() },
      { id: "m3", role: "student", kind: "draw", body: "The kitchen. Chloroplast.", coins: 0, cacheHit: false, createdAt: now() },
      {
        id: "m4",
        role: "dhi",
        kind: "draw",
        body: "The pore only lets air in. The cooking happens in a small green room inside the cell — the chloroplast. Gold threads of light become sugar. That is photosynthesis, as a kitchen.",
        coins: 8,
        cacheHit: false,
        canvasId: "cv_leaf",
        createdAt: now(),
      },
    ],
  };
  const story: DeskThread = {
    id: "th_story",
    title: "Hearths in the grove",
    kind: "story",
    preview: "Mitochondria as lanterns around the page.",
    updatedAt: now(),
    canvas: {
      id: "cv_story",
      src: "/desk/cell-story.jpg",
      caption: "Each lantern is a hearth. Food is the wood. ATP is the coin.",
      cacheKey: "story:cell-hearth",
    },
    messages: [
      { id: "s1", role: "student", kind: "story", body: "Tell mitochondria as a story.", coins: 0, cacheHit: false, createdAt: now() },
      {
        id: "s2",
        role: "dhi",
        kind: "story",
        body: "A child sits under the banyan with a page. Around the page, small lanterns. Each lantern is a hearth in the cell. The wood is food. The coin the hearth mints is ATP — the only coin the body can spend. That is why we call it the power house: not because it is loud, but because it pays.",
        coins: 5,
        cacheHit: false,
        canvasId: "cv_story",
        createdAt: now(),
      },
    ],
  };
  return {
    studentId: STUDENT_ID,
    wallet: { studentId: STUDENT_ID, allotment: 120, bonus: 0, spent: 13 },
    threads: [leaf, story],
    cache: {
      "draw:leaf-kitchen": { kind: "draw", hits: 1 },
      "story:cell-hearth": { kind: "story", hits: 1 },
    },
  };
}

export function loadDesk(): DeskStore {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DeskStore;
  } catch {
    /* ignore */
  }
  const s = seed();
  saveDesk(s);
  return s;
}

export function saveDesk(store: DeskStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function newThread(store: DeskStore): DeskStore {
  const t: DeskThread = {
    id: uid(),
    title: "New sitting",
    kind: "talk",
    preview: "Waiting for the first line.",
    updatedAt: now(),
    messages: [],
    canvas: null,
  };
  const next = { ...store, threads: [t, ...store.threads] };
  saveDesk(next);
  return next;
}

function intent(text: string, starter?: DeskKind): DeskKind {
  if (starter) return starter;
  const t = text.toLowerCase();
  if (/draw|visual|illustrat|picture|image|show me|diagram/.test(t)) return "draw";
  if (/story|tale|narrat/.test(t)) return "story";
  if (/mock|mcq|quiz|test me/.test(t)) return "mock";
  if (/write|essay|answer sheet/.test(t)) return "write";
  if (/paper|hard question|revision|shubham/.test(t)) return "paper";
  if (/pdf|page \d|attachment/.test(t)) return "pdf";
  return "talk";
}

function cacheKey(kind: DeskKind, text: string) {
  const t = text.toLowerCase();
  if (kind === "draw" && /leaf|chloro|photosynth|kitchen/.test(t)) return "draw:leaf-kitchen";
  if (kind === "draw" && /mito|hearth|atp/.test(t)) return "story:cell-hearth";
  if (kind === "story") return "story:cell-hearth";
  if (kind === "paper") return "paper:bio-m1";
  if (kind === "mock") return "mock:bio-3";
  return `${kind}:${t.slice(0, 48)}`;
}

function cachedCanvas(key: string) {
  if (key === "draw:leaf-kitchen") {
    return { id: "cv_leaf", src: "/desk/leaf-kitchen.jpg", caption: "The kitchen is inside the green grain — sunlight in, sugar out.", cacheKey: key };
  }
  if (key === "story:cell-hearth") {
    return { id: "cv_story", src: "/desk/cell-story.jpg", caption: "Each lantern is a hearth. Food is the wood. ATP is the coin.", cacheKey: key };
  }
  return null;
}

function dhiBody(kind: DeskKind, text: string, hit: boolean): string {
  if (hit) return "I already sat with this. Opening the saved sitting — no coins spent.";
  if (kind === "draw") {
    return "The pore only lets air in. The cooking happens in a small green room inside the cell — the chloroplast. Gold threads of light become sugar.";
  }
  if (kind === "story") {
    return "A child sits under the banyan. Lanterns around the page. Each lantern is a hearth. The wood is food. The coin is ATP. That is the power house — not loud, just paying.";
  }
  if (kind === "paper") {
    return "From Shubham Raj’s biology paper, question 1. A leaf is a kitchen. Where does the actual cooking of sugar from sunlight happen? The trap is stomata — they only breathe. The kitchen is the chloroplast. Sit with that before you look at the options.";
  }
  if (kind === "write") {
    return "Write as if the teacher is kind. I will sit with the gaps, not the marks. When you are done, send the page.";
  }
  if (kind === "pdf") {
    return "I have the pages. Which sitting shall we take from page 1 — a picture, a story, or a short teaching?";
  }
  if (kind === "mock") {
    return "Three questions from the same grove. Pick. I will not score you. I will show where the sitting was thin.";
  }
  return `Let us sit with that. Say if you want a picture, a story, a mock, or a page to write — I will not spend coins until you choose.`;
}

function clarify(kind: DeskKind): string | null {
  if (kind === "draw") return "Before I draw — the leaf kitchen (chloroplast) or the cell’s hearth (mitochondria)? One picture. Eight coins if I have not drawn it before.";
  if (kind === "talk") return "Which subject is this sitting, and do you want a picture, a story, a mock, or just the short teaching?";
  return null;
}

export function sit(
  store: DeskStore,
  threadId: string,
  text: string,
  starter?: DeskKind,
): { store: DeskStore; thinking: string; needsClarify: boolean } {
  const kind = intent(text, starter);
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return { store, thinking: "", needsClarify: false };

  const studentMsg = {
    id: uid(),
    role: "student" as const,
    kind,
    body: text,
    coins: 0,
    cacheHit: false,
    createdAt: now(),
  };

  const last = thread.messages.filter((m) => m.role === "dhi").at(-1);
  const alreadyClarified = last?.kind === "clarify";
  const q = clarify(kind);

  if (q && !alreadyClarified && !starter && kind !== "paper" && kind !== "mock" && kind !== "write" && kind !== "pdf") {
    const dhi = { id: uid(), role: "dhi" as const, kind: "clarify" as DeskKind, body: q, coins: 0, cacheHit: false, createdAt: now() };
    const nextThread = {
      ...thread,
      title: thread.messages.length ? thread.title : text.slice(0, 36),
      preview: q.slice(0, 48),
      updatedAt: now(),
      kind,
      messages: [...thread.messages, studentMsg, dhi],
    };
    const next = { ...store, threads: store.threads.map((t) => (t.id === threadId ? nextThread : t)) };
    saveDesk(next);
    return { store: next, thinking: "DHI is asking, not spending.", needsClarify: true };
  }

  const key = cacheKey(kind, text + " " + (thread.messages.map((m) => m.body).join(" ")));
  const hit = Boolean(store.cache[key]);
  const cost = hit ? 0 : (COSTS[kind as keyof typeof COSTS] ?? COSTS.chat);
  const left = coinsLeft(store.wallet);
  if (cost > left) {
    const dhi = {
      id: uid(),
      role: "dhi" as const,
      kind,
      body: "The bowl is empty for this month. Ask the house admin for coins, or wait for the next allotment. I can still open saved sittings.",
      coins: 0,
      cacheHit: false,
      createdAt: now(),
    };
    const nextThread = { ...thread, messages: [...thread.messages, studentMsg, dhi], updatedAt: now() };
    const next = { ...store, threads: store.threads.map((t) => (t.id === threadId ? nextThread : t)) };
    saveDesk(next);
    return { store: next, thinking: "", needsClarify: false };
  }

  const canvas = kind === "draw" || kind === "story" ? cachedCanvas(key) : null;
  const dhi = {
    id: uid(),
    role: "dhi" as const,
    kind,
    body: dhiBody(kind, text, hit),
    coins: cost,
    cacheHit: hit,
    canvasId: canvas?.id,
    createdAt: now(),
    mock:
      kind === "mock"
        ? [
            { q: "Where does the leaf cook sugar from sunlight?", options: ["Stomata", "Chloroplast", "Xylem", "Root hair"], answer: 1 },
            { q: "What coin does the hearth mint?", options: ["Glucose", "DNA", "ATP", "Chlorophyll"], answer: 2 },
            { q: "Stomata are mostly for —", options: ["Minerals", "Gases and vapour", "Proteins", "Food to the root"], answer: 1 },
          ]
        : undefined,
    writing: kind === "write" ? { prompt: "In six lines: why is the chloroplast a kitchen, not a door?", draft: "" } : undefined,
  };

  const nextThread: DeskThread = {
    ...thread,
    title: thread.messages.length ? thread.title : text.slice(0, 36) || STARTERS.find((s) => s.kind === kind)?.title || "Sitting",
    preview: dhi.body.slice(0, 52),
    kind,
    updatedAt: now(),
    messages: [...thread.messages, studentMsg, dhi],
    canvas: canvas ?? thread.canvas,
  };
  const cache = hit ? { ...store.cache, [key]: { kind, hits: (store.cache[key]?.hits ?? 0) + 1 } } : { ...store.cache, [key]: { kind, hits: 1 } };
  const next: DeskStore = {
    ...store,
    wallet: { ...store.wallet, spent: store.wallet.spent + cost },
    threads: [nextThread, ...store.threads.filter((t) => t.id !== threadId)],
    cache,
  };
  saveDesk(next);
  return {
    store: next,
    thinking: hit ? "Opening a saved sitting…" : kind === "draw" ? "DHI is drawing…" : kind === "story" ? "DHI is telling it…" : "DHI is sitting with this…",
    needsClarify: false,
  };
}

export function saveDraft(store: DeskStore, threadId: string, messageId: string, draft: string) {
  const next = {
    ...store,
    threads: store.threads.map((t) =>
      t.id !== threadId
        ? t
        : { ...t, messages: t.messages.map((m) => (m.id === messageId && m.writing ? { ...m, writing: { ...m.writing, draft } } : m)) },
    ),
  };
  saveDesk(next);
  return next;
}

export function pickMock(store: DeskStore, threadId: string, messageId: string, index: number, pick: number) {
  const next = {
    ...store,
    threads: store.threads.map((t) =>
      t.id !== threadId
        ? t
        : {
            ...t,
            messages: t.messages.map((m) =>
              m.id === messageId && m.mock ? { ...m, mock: m.mock.map((q, i) => (i === index ? { ...q, pick } : q)) } : m,
            ),
          },
    ),
  };
  saveDesk(next);
  return next;
}

export function attachPdf(store: DeskStore, threadId: string, name: string) {
  return sit(store, threadId, `Attached ${name}`, "pdf");
}

export function thinkingLine(kind?: DeskKind) {
  if (kind === "draw") return "DHI is drawing…";
  if (kind === "story") return "DHI is telling it…";
  if (kind === "mock") return "DHI is laying the questions…";
  if (kind === "paper") return "Looking through your papers…";
  if (kind === "pdf") return "Reading the pages…";
  return "DHI is sitting with this…";
}
