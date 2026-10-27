import assert from "node:assert/strict";
import { test } from "node:test";
import { securityHeaders } from "./security-headers.ts";

test("the house pages may not be framed, stay on HTTPS and never sniff a type", () => {
  const h = securityHeaders("https://abundant-caiman-975.convex.cloud");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(h["Strict-Transport-Security"], /max-age=31536000/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  for (const part of ["object-src 'none'", "base-uri 'none'", "form-action 'self'", "default-src 'self'"]) assert.ok(h["Content-Security-Policy"].includes(part), part);
});

const STREAM_HOSTS = /^(https|wss):\/\/\*\.(stream-io-api\.com|stream-io-video\.com|stream-io-cdn\.com|getstream\.io)$/;

test("the page talks only to itself, the Convex deployment it was built for and Stream's call service", () => {
  const csp = securityHeaders("https://abundant-caiman-975.convex.cloud")["Content-Security-Policy"];
  const connect = csp.split("; ").find((d) => d.startsWith("connect-src")) ?? "";
  assert.ok(connect.startsWith("connect-src 'self' https://abundant-caiman-975.convex.cloud wss://abundant-caiman-975.convex.cloud https://abundant-caiman-975.convex.site "));
  assert.ok(connect.includes("wss://*.stream-io-video.com") && connect.includes("https://*.stream-io-api.com"));
  assert.ok(!csp.includes("proper-camel-616"), "the production policy names the development deployment");
  assert.ok(!/localhost|\bws:/.test(csp), "the production policy allows the dev socket");
  for (const word of csp.split(/[ ;]+/).filter((w) => w.includes("*"))) assert.match(word, STREAM_HOSTS, `a wildcard other than Stream's: ${word}`);
  assert.ok(!/unsafe-eval|grok\.com/.test(csp), "the production policy allows eval or the dev preview");
  assert.ok(!/script-src[^;]*stream/.test(csp), "Stream may not run scripts");
});

test("the camera, microphone and screen share are for the house's own pages only, for the counseling call", () => {
  const p = securityHeaders("https://abundant-caiman-975.convex.cloud")["Permissions-Policy"];
  assert.match(p, /camera=\(self\)/);
  assert.match(p, /microphone=\(self\)/);
  assert.match(p, /display-capture=\(self\)/);
  assert.match(p, /geolocation=\(\)/);
});

test("the dev server may also open its own reload socket, and a missing address allows only the page itself", () => {
  assert.match(securityHeaders("https://proper-camel-616.ap-southeast-2.convex.cloud", { dev: true })["Content-Security-Policy"], /ws:\/\/localhost:\*/);
  const none = securityHeaders("")["Content-Security-Policy"];
  assert.ok(none.includes("connect-src 'self'"));
  assert.ok(!none.includes("convex"));
});
