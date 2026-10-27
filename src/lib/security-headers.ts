// The security headers of every page the house Worker renders (the production pentest of 2026-10-27; the owner's yes). Pure, so it is tested.
// - No other site may frame a house page (clickjacking): frame-ancestors 'none' and X-Frame-Options DENY.
// - The browser stays on HTTPS for a year (HSTS), never guesses a file's type (nosniff), and sends only the origin to other sites.
// - The content policy lets the page talk only to itself and its own Convex deployment (the address the build was made for), and load pictures,
//   films and fonts from itself, Convex storage and data or blob addresses (a blog photo before upload, the desk's checked diagram). Scripts must be
//   the house's own; 'unsafe-inline' stays because the framework writes two inline scripts into each page to hand over its state.
// - On the dev server only: the dev server's socket (Vite's reload), the Grok app builder's preview script and its framing from grok.com, and eval
//   (used by the dev tooling). A production build never gets these (security-headers.test.ts).
export function securityHeaders(convexUrl: string, opts: { dev?: boolean } = {}): Record<string, string> {
  let cloud = "";
  let site = "";
  try {
    const u = new URL(convexUrl);
    cloud = u.origin;
    site = u.origin.replace(/\.convex\.cloud$/, ".convex.site");
  } catch {
    // No address: the page talks to itself only.
  }
  const convex = cloud ? [cloud, cloud.replace(/^https:/, "wss:"), site] : [];
  const dev = opts.dev ? ["ws:", "http://localhost:*", "ws://localhost:*"] : [];
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${opts.dev ? " 'unsafe-eval' https://grok.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${[cloud, site].filter(Boolean).join(" ")}`.trim(),
    `media-src 'self' blob: ${[cloud, site].filter(Boolean).join(" ")}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${[...convex, ...dev].join(" ")}`.trim(),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    opts.dev ? "frame-ancestors 'self' https://grok.com https://*.grok.com" : "frame-ancestors 'none'",
  ].join("; ");
  return {
    "Content-Security-Policy": policy,
    ...(opts.dev ? {} : { "X-Frame-Options": "DENY" }),
    "Strict-Transport-Security": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}
