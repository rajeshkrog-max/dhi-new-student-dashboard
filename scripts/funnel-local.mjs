// @ts-check
/**
 * The funnel's interview served beside the house on one address, for local work only (spec 0008). In production one domain holds both
 * (spec 0004: `/dhiinterviews*`, `/s/*`, `/api/*` and `/_astro/*` stay with the funnel). Locally the funnel's own dev server runs on another
 * port, so its sign in cookie would not be the house's. This serves the funnel's BUILT files (`apps/joining/dist`, made by
 * `pnpm --filter dhirise build`) from the house's dev server, and forwards the funnel's other `/api/*` routes to the shared Convex
 * deployment, so a student signs in once and the interview, the dashboard and the sign in cookie share `localhost:8080`.
 *
 * `/api/auth` is not here: the house already forwards it (scripts/auth-proxy.mjs) with the house's own forwarded host.
 * Nothing in this file reaches a build: it is a `configureServer` hook, which only the dev server runs.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createReadStream } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const TYPES = /** @type {Record<string, string>} */ ({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
});

export const FUNNEL_CONFIG_PATH = "/dhiinterviews/js/funnel-config.js";

/**
 * Which built file answers a path, mirroring the funnel's `_redirects` (`/dhiinterviews` to the landing page, `/s/*` to the shared page) and
 * the file format of the build (`/dhiinterviews/landing` is `landing.html`). Anything outside the funnel's paths is not ours.
 * @param {string} distDir the funnel's build folder
 * @param {string | undefined} url the request url, path and query
 * @returns {{ redirect: string } | { file: string } | null} null: not a funnel path, or no such file
 */
export function resolveFunnelFile(distDir, url) {
  let path;
  try {
    path = decodeURIComponent((url ?? "").split("?", 1)[0]);
  } catch {
    return null;
  }
  if (path === "/dhiinterviews" || path === "/dhiinterviews/") return { redirect: "/dhiinterviews/landing.html" };
  if (path.startsWith("/s/")) path = "/dhiinterviews/shared.html";
  if (!path.startsWith("/dhiinterviews/") && !path.startsWith("/_astro/")) return null;

  // Only the funnel's two folders are served, so a `..` that stays inside the build folder but leaves them is refused too.
  const root = resolve(distDir);
  const folder = resolve(join(root, path.startsWith("/_astro/") ? "_astro" : "dhiinterviews"));
  for (const candidate of [path, extname(path) === "" ? `${path}.html` : ""]) {
    if (!candidate) continue;
    const file = resolve(join(root, candidate));
    if (!file.startsWith(folder + sep)) return null;
    if (existsSync(file) && statSync(file).isFile()) return { file };
  }
  return null;
}

/**
 * A connect style middleware: serves the funnel's built files, and adds `dashboardUrl` to the funnel's config file (the funnel's own file
 * ships with it empty; real deploys set it only when the house is live on the address).
 * @param {{ distDir: string, dashboardUrl: string }} options
 */
export function createFunnelMiddleware({ distDir, dashboardUrl }) {
  return (
    /** @type {import("node:http").IncomingMessage} */ req,
    /** @type {import("node:http").ServerResponse} */ res,
    /** @type {() => void} */ next,
  ) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const hit = resolveFunnelFile(distDir, req.url);
    if (!hit) return next();
    if ("redirect" in hit) {
      res.writeHead(302, { location: hit.redirect });
      res.end();
      return;
    }
    const type = TYPES[extname(hit.file).toLowerCase()] ?? "application/octet-stream";
    const path = (req.url ?? "").split("?", 1)[0];
    if (path === FUNNEL_CONFIG_PATH) {
      const body = `${readFileSync(hit.file, "utf8")}\nwindow.DHI_FUNNEL.dashboardUrl = ${JSON.stringify(dashboardUrl)};\n`;
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    if (req.method === "HEAD") res.end();
    else createReadStream(hit.file).pipe(res);
  };
}

/**
 * The funnel's other forwarders (`functions/api/*`), as Vite proxy entries to the shared Convex deployment. Empty with no address.
 * @param {string | undefined} convexSiteUrl
 * @returns {Record<string, import("vite").ProxyOptions>}
 */
export function funnelApiProxy(convexSiteUrl) {
  const target = convexSiteUrl?.trim();
  if (!target) return {};
  return Object.fromEntries(
    ["files", "render", "team", "avatar", "shared", "referral"].map((name) => [`/api/${name}`, { target, changeOrigin: true }]),
  );
}

/**
 * @param {{ distDir: string, dashboardUrl?: string }} options
 * @returns {import("vite").Plugin}
 */
export function funnelLocalPlugin({ distDir, dashboardUrl = "/dashboard" }) {
  return {
    name: "dhi:funnel-local",
    apply: "serve",
    configureServer(server) {
      if (!existsSync(join(distDir, "dhiinterviews", "landing.html"))) {
        server.config.logger.warn(
          "[funnel-local] apps/joining/dist is missing, so /dhiinterviews cannot be served here. Run: pnpm --filter dhirise build",
        );
        return;
      }
      server.middlewares.use(createFunnelMiddleware({ distDir, dashboardUrl }));
    },
  };
}
