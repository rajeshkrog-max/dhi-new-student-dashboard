/// <reference types="vite/client" />
// Every development helper (`*Proof.ts`, and the demo seed) is internal and refuses to run where the test sign in is off, so none of them can act on
// production: a scan of each exported function, and the rehearsal helper run for real with the switch off.
import { afterEach, describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";

afterEach(() => {
  delete process.env.TEST_SIGNIN_ENABLED;
});

describe("the development helpers refuse where the test sign in is off", () => {
  test("every exported function of a proof file is internal and checks TEST_SIGNIN_ENABLED before anything else", () => {
    const files = import.meta.glob(["./*Proof.ts", "./demo.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(8);
    for (const [name, text] of Object.entries(files)) {
      expect(/^export const \w+ = (query|mutation|action)\(/m.test(text), `${name} exports a public function`).toBe(false);
      for (const m of text.matchAll(/^export const (\w+) = internal(Mutation|Action|Query)\(\{[\s\S]*?handler: async \([^)]*\) => \{\s*\n([^\n]*)/gm)) {
        expect(m[3], `${name} ${m[1]} does not start with the test sign in check`).toMatch(/TEST_SIGNIN_ENABLED !== "true"/);
      }
    }
  });

  test("the rehearsal helper refuses with the switch off and makes nothing", async () => {
    const t = makeBackend();
    process.env.TEST_SIGNIN_ENABLED = "false";
    await expect(t.mutation(internal.rehearsalProof.setup, { tag: "abc" })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("institutes").take(5))).toEqual([]);
  });
});
