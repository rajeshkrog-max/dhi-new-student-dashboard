// The Convex functions run in memory with convex-test (edge runtime, like Convex itself), spec 0001 testing decision.
// The browser script tests stay in the funnel (apps/joining/tests).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "convex",
    include: ["convex/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test", "@convex-dev/better-auth"] } },
  },
});
