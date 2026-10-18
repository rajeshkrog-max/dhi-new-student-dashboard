// The shared engine scripts (spec 0001, child 0002): packages/engine holds questions.js and score.js, and the funnel serves
// copies of them at the old public addresses. The copies are generated (scripts/sync-engine.mjs) and git ignored. This fails
// when a copy is missing or is not the package's file, so a page can never load a stale or absent engine.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ENGINE_FILES, engineStatus } from "../scripts/sync-engine.mjs";

describe("engine copies", () => {
  test("every shared engine script is served from public/dhiinterviews/js/engine, identical to packages/engine", () => {
    expect(engineStatus()).toEqual(ENGINE_FILES.map((file) => ({ file, state: "ok" })));
  });

  test("the copies are git ignored, so only the package holds the source", () => {
    const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8").split(/\r?\n/);
    for (const file of ENGINE_FILES) expect(ignore).toContain(`public/dhiinterviews/js/engine/${file}`);
  });

  test("the pages still name the engine at the same public addresses", () => {
    const question = readFileSync(new URL("../src/pages/dhiinterviews/question.astro", import.meta.url), "utf8");
    expect(question).toContain('src="js/engine/questions.js"');
    expect(question).toContain('src="js/engine/score.js"');
  });
});
