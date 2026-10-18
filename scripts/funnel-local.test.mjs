import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  FUNNEL_CONFIG_PATH,
  createFunnelMiddleware,
  funnelApiProxy,
  resolveFunnelFile,
} from "./funnel-local.mjs";

/** A tiny built funnel: a landing page, a shared page, a config file and one asset. */
function builtFunnel() {
  const dist = mkdtempSync(join(tmpdir(), "funnel-dist-"));
  mkdirSync(join(dist, "dhiinterviews", "js"), { recursive: true });
  mkdirSync(join(dist, "_astro"), { recursive: true });
  writeFileSync(join(dist, "dhiinterviews", "landing.html"), "<p>landing</p>");
  writeFileSync(join(dist, "dhiinterviews", "shared.html"), "<p>shared</p>");
  writeFileSync(join(dist, "dhiinterviews", "js", "funnel-config.js"), 'window.DHI_FUNNEL = { shareUrl: "" };');
  writeFileSync(join(dist, "_astro", "app.js"), "console.log(1)");
  writeFileSync(join(dist, "secret.txt"), "not the funnel's");
  return { dist, done: () => rmSync(dist, { recursive: true, force: true }) };
}

async function front(dist) {
  const middleware = createFunnelMiddleware({ distDir: dist, dashboardUrl: "/dashboard" });
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end("next");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return { port, close: () => new Promise((resolve) => server.close(resolve)) };
}

function get(port, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("spec 0008: the funnel's paths map to built files, like the funnel's own redirects and file format", () => {
  const { dist, done } = builtFunnel();
  try {
    assert.deepEqual(resolveFunnelFile(dist, "/dhiinterviews"), { redirect: "/dhiinterviews/landing.html" });
    assert.deepEqual(resolveFunnelFile(dist, "/dhiinterviews/"), { redirect: "/dhiinterviews/landing.html" });
    assert.ok("file" in /** @type {object} */ (resolveFunnelFile(dist, "/dhiinterviews/landing.html?v=abc")));
    assert.ok("file" in /** @type {object} */ (resolveFunnelFile(dist, "/dhiinterviews/landing")), "no extension means .html");
    assert.ok("file" in /** @type {object} */ (resolveFunnelFile(dist, "/s/ANYCODE123")), "/s/* is the shared page");
    assert.ok("file" in /** @type {object} */ (resolveFunnelFile(dist, "/_astro/app.js")));
  } finally {
    done();
  }
});

test("spec 0008: a path that is not the funnel's, or has no file, or climbs out of the build folder, is left alone", () => {
  const { dist, done } = builtFunnel();
  try {
    assert.equal(resolveFunnelFile(dist, "/enter"), null);
    assert.equal(resolveFunnelFile(dist, "/dashboard"), null);
    assert.equal(resolveFunnelFile(dist, "/dhiinterviews/missing.html"), null);
    assert.equal(resolveFunnelFile(dist, "/dhiinterviews/../secret.txt"), null);
    assert.equal(resolveFunnelFile(dist, "/dhiinterviews/%2e%2e/secret.txt"), null);
    assert.equal(resolveFunnelFile(dist, "/_astro/../secret.txt"), null);
    assert.equal(resolveFunnelFile(dist, "/dhiinterviews/%E0%A4%A"), null, "a broken escape is not served");
    assert.equal(resolveFunnelFile(dist, undefined), null);
  } finally {
    done();
  }
});

test("spec 0008: the middleware serves a page with its type, redirects the bare path, and passes everything else on", async () => {
  const { dist, done } = builtFunnel();
  const fr = await front(dist);
  try {
    const page = await get(fr.port, "/dhiinterviews/landing.html");
    assert.equal(page.status, 200);
    assert.match(page.headers["content-type"], /text\/html/);
    assert.equal(page.body, "<p>landing</p>");
    const bare = await get(fr.port, "/dhiinterviews");
    assert.equal(bare.status, 302);
    assert.equal(bare.headers.location, "/dhiinterviews/landing.html");
    const other = await get(fr.port, "/enter");
    assert.equal(other.body, "next");
    const post = await get(fr.port, "/dhiinterviews/landing.html", "POST");
    assert.equal(post.body, "next", "only GET and HEAD are served");
    const head = await get(fr.port, "/dhiinterviews/landing.html", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
  } finally {
    await fr.close();
    done();
  }
});

test("spec 0008: the funnel's config file gets the dashboard address added, and no other file does", async () => {
  const { dist, done } = builtFunnel();
  const fr = await front(dist);
  try {
    const config = await get(fr.port, `${FUNNEL_CONFIG_PATH}?v=1`);
    assert.match(config.body, /window\.DHI_FUNNEL = \{ shareUrl: "" \};/);
    assert.match(config.body, /window\.DHI_FUNNEL\.dashboardUrl = "\/dashboard";/);
    const asset = await get(fr.port, "/_astro/app.js");
    assert.equal(asset.body, "console.log(1)");
  } finally {
    await fr.close();
    done();
  }
});

test("spec 0008: the funnel's other api routes are forwarded to the shared deployment, and auth is left to the house's own proxy", () => {
  const proxy = funnelApiProxy("https://example.convex.site");
  assert.deepEqual(Object.keys(proxy).sort(), ["/api/avatar", "/api/files", "/api/referral", "/api/render", "/api/shared", "/api/team"]);
  assert.equal(proxy["/api/auth"], undefined);
  assert.equal(proxy["/api/files"].target, "https://example.convex.site");
  assert.deepEqual(funnelApiProxy(undefined), {});
  assert.deepEqual(funnelApiProxy("  "), {});
});
