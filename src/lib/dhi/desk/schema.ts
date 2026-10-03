/**
 * DHI desk — token wallet + sittings. Admin writes the allotment.
 *
 * dhi_wallets
 *   student_id pk
 *   period_start date          — IST month
 *   allotment int              — admin
 *   bonus int                  — later: purchased coins
 *   spent int
 *
 * dhi_threads
 *   id, student_id, title, kind, updated_at
 *
 * dhi_messages
 *   id, thread_id, role student|dhi, kind talk|clarify|draw|story|mock|write|paper|pdf
 *   body text, coins int, cache_hit bool, canvas_id, created_at
 *
 * dhi_canvas
 *   id, thread_id, cache_key, image_path, caption
 *
 * dhi_cache
 *   cache_key pk, kind, payload jsonb, hits
 *   HIT = do not call an LLM / image API. Return payload. coins = 0.
 *
 * dhi_attachments
 *   id, thread_id, name, mime, size_bytes  — pdf/image. DHI reads; never stores counselor media.
 *
 * Coins are spent only on a MISS. Clarify questions are free.
 */

export const STUDENT_ID = "stu_suzzy_glass";
export const STORE_KEY = "dhi-desk-v1";

export const COSTS = {
  chat: 1,
  draw: 8,
  story: 5,
  mock: 4,
  write: 2,
  paper: 2,
  pdf: 3,
} as const;

export type DeskKind = "talk" | "clarify" | "draw" | "story" | "mock" | "write" | "paper" | "pdf";

export type DeskMessage = {
  id: string;
  role: "student" | "dhi";
  kind: DeskKind;
  body: string;
  coins: number;
  cacheHit: boolean;
  canvasId?: string;
  mock?: { q: string; options: string[]; pick?: number; answer: number }[];
  writing?: { prompt: string; draft: string };
  createdAt: string;
};

export type DeskThread = {
  id: string;
  title: string;
  kind: DeskKind;
  preview: string;
  updatedAt: string;
  messages: DeskMessage[];
  canvas: { id: string; src: string; caption: string; cacheKey: string } | null;
};

export type DeskWallet = {
  studentId: string;
  allotment: number;
  bonus: number;
  spent: number;
};

export type DeskStore = {
  studentId: string;
  wallet: DeskWallet;
  threads: DeskThread[];
  cache: Record<string, { kind: DeskKind; hits: number }>;
};

export function coinsLeft(w: DeskWallet) {
  return Math.max(0, w.allotment + w.bonus - w.spent);
}
