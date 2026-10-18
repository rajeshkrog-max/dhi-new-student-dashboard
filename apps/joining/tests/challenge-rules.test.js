// The challenge rules that the browser repeats must equal the server's (spec 0015, AC-4; spec 0016, AC-1). The code pattern is written in
// convex/challengeRules.ts and again in js/api.js. The end date is optional and lives in the server's CHALLENGE_ENDS_AT setting (spec 0008);
// the browser repeats it in challenge-config.js only when one is set, and the repo ships with none. This fails if they differ.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CODE_RE } from "@dhi/backend/challengeRules";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("rules the browser repeats", () => {
  test("spec 0008: challenge-config.js has no end date in the repo, so the challenge runs on", () => {
    expect(read("public/dhiinterviews/js/challenge-config.js")).toMatch(/endsAt: "",/);
  });

  test("spec 0008: js/api.js holds no end date of its own that could differ from the config", () => {
    const api = read("public/dhiinterviews/js/api.js");
    expect(api.match(/\d{4}-\d{2}-\d{2}T[\d:+.-]+/g) || []).toEqual([]);
  });

  test("covers 0016 AC-1: the code pattern in js/api.js is the server's pattern", () => {
    const m = read("public/dhiinterviews/js/api.js").match(/var CODE_RE = \/(.+)\/;/);
    expect(m && m[1]).toBe(CODE_RE.source);
  });
});
