// @ts-check
/**
 * `/api/auth` for the built Worker served locally (spec 0007, AC-12). The dev server forwards it with `server.proxy`. The Cloudflare
 * plugin answers every `vite preview` request in its own hook, before Vite adds `preview.proxy`, so that setting is never reached.
 * This plugin registers its middleware directly in `configurePreviewServer`, ahead of the Worker, and hands the same `authProxy()`
 * options to `http-proxy-3` (the library Vite itself uses), so redirects, several cookies and streaming behave as in dev.
 *
 * It lives in the preview server only: `configurePreviewServer` never runs in `vite dev` and nothing here reaches the build output,
 * so the house Worker still has no `/api/*` handler of its own (spec 0001 keeps `/api/*` for the funnel).
 */
import { createProxyServer } from "http-proxy-3";
import { authProxy } from "./auth-proxy.mjs";

export const AUTH_PREFIX = "/api/auth";

/**
 * True for `/api/auth` and `/api/auth/...` (any query string), and nothing else, so `/api/authx` is left alone.
 * @param {string | undefined} url the request url, path and query
 */
export function takesRequest(url) {
  const path = (url ?? "").split("?", 1)[0];
  return path === AUTH_PREFIX || path.startsWith(`${AUTH_PREFIX}/`);
}

/**
 * A connect style middleware that forwards the requests `takesRequest` accepts and calls `next()` for the rest. The options' `headers`
 * replace whatever the client sent (a forged forwarded host never survives), `Origin` passes through, and `Host` becomes the target's.
 * An unreachable backend answers 502 with an empty body and logs nothing about the request.
 * @param {import("vite").ProxyOptions} options
 */
export function createAuthProxyMiddleware(options) {
  const proxy = createProxyServer(/** @type {any} */ (options));
  proxy.on("error", (_error, _req, res) => {
    const response = /** @type {import("node:http").ServerResponse | undefined} */ (res);
    if (!response || typeof response.writeHead !== "function") return;
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "content-length": "0" });
    response.end();
  });
  return (
    /** @type {import("node:http").IncomingMessage} */ req,
    /** @type {import("node:http").ServerResponse} */ res,
    /** @type {() => void} */ next,
  ) => {
    if (!takesRequest(req.url)) return next();
    proxy.web(req, res);
  };
}

/**
 * @param {string | undefined} convexSiteUrl the shared deployment's `.convex.site` address (`CONVEX_SITE_URL`)
 * @returns {import("vite").Plugin}
 */
export function authProxyPreviewPlugin(convexSiteUrl) {
  const options = authProxy(convexSiteUrl)[AUTH_PREFIX];
  return {
    name: "dhi:auth-proxy-preview",
    enforce: "pre",
    configurePreviewServer(server) {
      if (!options) {
        server.config.logger.warn(
          "[auth-proxy-preview] CONVEX_SITE_URL is not set, so /api/auth is not forwarded (see .env.example).",
        );
        return;
      }
      // Registered directly, not as a returned post hook: a post hook would run after the Worker has already answered.
      server.middlewares.use(createAuthProxyMiddleware(options));
    },
  };
}
