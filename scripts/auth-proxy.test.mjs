import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUSE_HOST, authProxy } from "./auth-proxy.mjs";

const SITE = "https://example-123.convex.site";

test("spec 0007 AC-2: /api/auth goes to the shared deployment with the house's own host forwarded", () => {
  const proxy = authProxy(SITE);
  assert.deepEqual(Object.keys(proxy), ["/api/auth"]);
  const rule = proxy["/api/auth"];
  assert.equal(rule.target, SITE);
  assert.equal(rule.changeOrigin, true);
  assert.equal(rule.headers?.["x-better-auth-forwarded-host"], HOUSE_HOST);
  assert.equal(rule.headers?.["x-better-auth-forwarded-proto"], "http");
  assert.equal(rule.headers?.["x-forwarded-host"], HOUSE_HOST);
});

test("spec 0007 AC-2: the cookie domain is stripped and redirects are passed through to the browser", () => {
  const rule = authProxy(SITE)["/api/auth"];
  assert.equal(rule.cookieDomainRewrite, "");
  assert.equal(rule.followRedirects, false);
});

test("spec 0007 AC-15: no address means no proxy, so a clean build needs no .env.local", () => {
  assert.deepEqual(authProxy(undefined), {});
  assert.deepEqual(authProxy("   "), {});
});

test("spec 0007: only /api/auth is proxied, never the funnel's other /api addresses", () => {
  assert.deepEqual(Object.keys(authProxy(SITE)), ["/api/auth"]);
});
