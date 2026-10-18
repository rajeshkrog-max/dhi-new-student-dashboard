// @ts-check
/**
 * The `/api/auth` proxy of the house (spec 0007). The browser talks only to its own address, `localhost:8080`, and this forwards
 * `/api/auth/*` to the shared Convex deployment (`CONVEX_SITE_URL`), so the sign in cookie stays on one address.
 *
 * One object serves both `server.proxy` (dev) and, through `authProxyPreviewPlugin` in scripts/auth-proxy-preview.mjs, the built Worker
 * served by `vite preview` (Vite's own `preview.proxy` is never reached once the Cloudflare plugin answers), so the two cannot drift.
 * The forwarded host headers are what the backend's allow list judges (packages/backend/convex/trustedOrigins.ts): the funnel's own
 * forwarder (apps/joining/functions/api/auth/[[path]].ts) sends the same four.
 */

/** The address the house is served on in dev and preview. A deployed address is out of scope for this row. */
export const HOUSE_HOST = "localhost:8080";
export const HOUSE_PROTO = "http";

/**
 * @param {string | undefined} convexSiteUrl the shared deployment's `.convex.site` address
 * @returns {Record<string, import("vite").ProxyOptions>} empty when no address is configured, so a clean build needs no `.env.local`
 */
export function authProxy(convexSiteUrl) {
  const target = convexSiteUrl?.trim();
  if (!target) return {};
  return {
    "/api/auth": {
      target,
      changeOrigin: true,
      // Redirects (Google, back to the house) are the browser's to follow, never the proxy's.
      followRedirects: false,
      // The cookie belongs to localhost:8080, not to the Convex address.
      cookieDomainRewrite: "",
      headers: {
        "x-forwarded-host": HOUSE_HOST,
        "x-forwarded-proto": HOUSE_PROTO,
        "x-better-auth-forwarded-host": HOUSE_HOST,
        "x-better-auth-forwarded-proto": HOUSE_PROTO,
      },
    },
  };
}
