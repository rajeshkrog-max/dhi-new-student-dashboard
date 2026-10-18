// The Convex functions run in memory with convex-test (edge runtime, like Convex itself), spec 0001 testing decision.
// The browser script tests stay in the funnel (apps/joining/tests).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "convex",
    include: ["convex/**/*.test.ts"],
    environment: "edge-runtime",
    // The first test of a file loads the scoring engine and the Better Auth component, which can pass the 5 second default on a cold start
    // right after heavy work (seen in combined runs: avatars, sheetPrune). Some files already set 30 seconds themselves; this makes it the rule.
    testTimeout: 30_000,
    server: { deps: { inline: ["convex-test", "@convex-dev/better-auth"] } },
  },
});
