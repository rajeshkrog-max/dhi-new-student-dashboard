import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { test } from "node:test";
import { authProxy } from "./auth-proxy.mjs";
import {
  authProxyPreviewPlugin,
  createAuthProxyMiddleware,
  takesRequest,
} from "./auth-proxy-preview.mjs";

/** A real upstream that records what it was sent and answers by path. */
async function upstream() {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, headers: req.headers });
    if (req.url === "/api/auth/cookies") {
      res.setHeader("set-cookie", [
        "a=1; Path=/; Domain=example.convex.site",
        "b=2; Path=/; HttpOnly",
      ]);
      res.end("ok");
    } else if (req.url === "/api/auth/go") {
      res.writeHead(302, { location: "https://accounts.google.com/x" });
      res.end();
    } else {
      res.end("upstream:" + req.url);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return { seen, port, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** The middleware behind a tiny front server, where `next` answers "next:<url>" so the test can see what was left alone. */
async function front(port) {
  const options = authProxy(`http://127.0.0.1:${port}`)["/api/auth"];
  const middleware = createAuthProxyMiddleware(options);
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.end("next:" + req.url);
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port: frontPort } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return { frontPort, close: () => new Promise((resolve) => server.close(resolve)) };
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("spec 0007 AC-12: only /api/auth and /api/auth/... are taken, query kept, /api/authx and other paths left alone", () => {
  assert.equal(takesRequest("/api/auth"), true);
  assert.equal(takesRequest("/api/auth/sign-in/email"), true);
  assert.equal(takesRequest("/api/auth/get-session?disableCookieCache=true"), true);
  assert.equal(takesRequest("/api/authx"), false);
  assert.equal(takesRequest("/api/other"), false);
  assert.equal(takesRequest("/thread"), false);
  assert.equal(takesRequest(undefined), false);
});

test("spec 0007 AC-12: a forwarded request keeps its path and query, and a path that is not /api/auth goes to next()", async () => {
  const up = await upstream();
  const fr = await front(up.port);
  try {
    const hit = await get(fr.frontPort, "/api/auth/get-session?x=1");
    assert.equal(hit.body, "upstream:/api/auth/get-session?x=1");
    const miss = await get(fr.frontPort, "/api/authx");
    assert.equal(miss.body, "next:/api/authx");
    assert.equal(up.seen.length, 1, "the backend was asked for something that is not /api/auth");
  } finally {
    await fr.close();
    await up.close();
  }
});

test("spec 0007 AC-10 and AC-12: the forwarded host and proto headers replace a forged one, and Origin passes through", async () => {
  const up = await upstream();
  const fr = await front(up.port);
  try {
    await get(fr.frontPort, "/api/auth/ok", {
      "x-forwarded-host": "evil.example",
      "x-better-auth-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
      "x-better-auth-forwarded-proto": "https",
      origin: "http://localhost:8080",
    });
    const sent = up.seen[0].headers;
    assert.equal(sent["x-forwarded-host"], "localhost:8080");
    assert.equal(sent["x-better-auth-forwarded-host"], "localhost:8080");
    assert.equal(sent["x-forwarded-proto"], "http");
    assert.equal(sent["x-better-auth-forwarded-proto"], "http");
    assert.equal(sent.origin, "http://localhost:8080");
    assert.equal(sent.host, `127.0.0.1:${up.port}`, "Host is the target's");
  } finally {
    await fr.close();
    await up.close();
  }
});

test("spec 0007 AC-2: several set-cookie headers survive, with the Domain stripped, and a redirect is passed to the browser", async () => {
  const up = await upstream();
  const fr = await front(up.port);
  try {
    const cookies = await get(fr.frontPort, "/api/auth/cookies");
    const set = [].concat(cookies.headers["set-cookie"]);
    assert.equal(set.length, 2);
    assert.ok(
      set.every((c) => !/Domain=/i.test(c)),
      "a cookie kept its Domain",
    );
    const redirect = await get(fr.frontPort, "/api/auth/go");
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.location, "https://accounts.google.com/x");
  } finally {
    await fr.close();
    await up.close();
  }
});

test("spec 0007: an unreachable backend answers 502 with an empty body", async () => {
  const closed = await upstream();
  const port = closed.port;
  await closed.close();
  const fr = await front(port);
  try {
    const res = await get(fr.frontPort, "/api/auth/get-session");
    assert.equal(res.status, 502);
    assert.equal(res.body, "");
  } finally {
    await fr.close();
  }
});

test("spec 0007 AC-15: with no address the plugin registers nothing and warns once, so a clean build stays green", () => {
  const plugin = authProxyPreviewPlugin(undefined);
  assert.equal(plugin.enforce, "pre");
  const used = [];
  const warned = [];
  plugin.configurePreviewServer({
    middlewares: { use: (fn) => used.push(fn) },
    config: { logger: { warn: (m) => warned.push(m) } },
  });
  assert.equal(used.length, 0);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /CONVEX_SITE_URL/);
});

test("spec 0007 AC-12: with an address the plugin registers one middleware directly", () => {
  const plugin = authProxyPreviewPlugin("https://example.convex.site");
  const used = [];
  const result = plugin.configurePreviewServer({
    middlewares: { use: (fn) => used.push(fn) },
    config: { logger: { warn() {} } },
  });
  assert.equal(used.length, 1, "one middleware");
  assert.equal(
    result,
    undefined,
    "not a returned post hook, which would run after the Worker answered",
  );
});
