/// <reference types="vite/client" />
// The authorisation sweep of the production run (Phase 2): every public function of the house, found by scanning the files, is called signed out
// and must give nothing back. A role or another institute is proven room by room (houseAccess, healthAccess, studyAccess, brainWall, desk, papers,
// blog, studyHour, funnelLink, parentSharing); this net catches a new public function that forgot the entry check altogether.
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import { makeBackend } from "../tests/convexTestUtils";

// Public on purpose. The parent page takes a secret code and answers `gone` for anything else; `members.me` tells a stranger only that they are
// signed out (the front door needs it); `foods.groups` is the fixed list of food group names. Each is checked to give exactly that and no more.
const OPEN_ON_PURPOSE = new Set(["parentReport:open", "members:me", "foods:groups"]);

type Kind = "query" | "mutation" | "action";

function houseFunctions(): { ref: string; kind: Kind }[] {
  const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const out: { ref: string; kind: Kind }[] = [];
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith(".test.ts") || !/require(Member|MemberAllowLocked|DhiAdmin)\(/.test(text)) continue;
    const module = path.slice(2, -3);
    for (const m of text.matchAll(/^export const (\w+) = (query|mutation|action)\(\{/gm)) out.push({ ref: `${module}:${m[1]}`, kind: m[2] as Kind });
  }
  return out;
}

describe("the authorisation sweep", () => {
  test("every public house function gives a signed out caller nothing", async () => {
    const t = makeBackend();
    const all = houseFunctions();
    expect(all.length).toBeGreaterThan(100);
    const served: string[] = [];
    for (const { ref, kind } of all) {
      if (OPEN_ON_PURPOSE.has(ref)) continue;
      try {
        const r = (await (kind === "query"
          ? t.query(makeFunctionReference<"query", Record<string, never>, unknown>(ref), {})
          : kind === "mutation"
            ? t.mutation(makeFunctionReference<"mutation", Record<string, never>, unknown>(ref), {})
            : t.action(makeFunctionReference<"action", Record<string, never>, unknown>(ref), {}))) as { ok?: boolean } | null;
        // A plain refusal object is fine; anything else that came back is data served to a stranger.
        if (!(r && r.ok === false)) served.push(ref);
      } catch {
        // Refused: not signed in, or the arguments were refused before the handler ran.
      }
    }
    expect(served, `served to a signed out caller: ${served.join(", ")}`).toEqual([]);
    expect(await t.query(makeFunctionReference<"query", Record<string, never>, unknown>("members:me"), {})).toEqual({ state: "signedOut" });
    expect(await t.query(makeFunctionReference<"query", Record<string, never>, unknown>("foods:groups"), {})).toEqual(["grain", "dal", "vegetable", "dairy", "fruit"]);
  });
});
