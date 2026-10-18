// The funnel's unit tests: the plain browser scripts (js/engine/*) and the page bridge, run in Node (tests/).
// The Convex function tests moved with the backend to packages/backend (spec 0001, child 0002).
// Browser flow tests live in e2e/ and run with Playwright (see playwright.config.ts).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "pages",
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
