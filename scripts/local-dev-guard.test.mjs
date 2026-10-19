import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTION_DEPLOYMENT, isLocalHost, refusalReason } from "./local-dev-guard.mjs";

test("only this machine is allowed", () => {
  assert.equal(isLocalHost("localhost"), true);
  assert.equal(isLocalHost("127.0.0.1"), true);
  assert.equal(isLocalHost("dhirise.com"), false);
  assert.match(refusalReason({ url: "https://dhirise.com" }), /only runs against this machine/);
  assert.equal(refusalReason({ url: "http://localhost:8080" }), null);
});

test("a production backend in .env.local, in the environment or in the funnel build stops the run", () => {
  const url = "http://localhost:8080";
  assert.match(refusalReason({ url, envText: `PUBLIC_CONVEX_URL=https://${PRODUCTION_DEPLOYMENT}.convex.cloud` }), /production/);
  assert.match(refusalReason({ url, envValue: `https://${PRODUCTION_DEPLOYMENT}.convex.cloud` }), /production/);
  assert.match(refusalReason({ url, funnelBuilds: ["a", `b ${PRODUCTION_DEPLOYMENT}`] }), /built for production/);
  assert.equal(refusalReason({ url, envText: "PUBLIC_CONVEX_URL=https://dev-123.convex.cloud", funnelBuilds: ["a"] }), null);
});
