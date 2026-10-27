// The house's server setup (TanStack Start): one request middleware that puts the security headers on every page the Worker renders
// (src/lib/security-headers.ts; the production pentest of 2026-10-27). The static files under /assets and public/ are served by Cloudflare without
// the Worker, so they get theirs from public/_headers.
import { createMiddleware, createStart } from "@tanstack/react-start";
import { securityHeaders } from "@/lib/security-headers";

const withSecurityHeaders = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const result = await next();
  const headers = securityHeaders(import.meta.env.PUBLIC_CONVEX_URL as string, { dev: import.meta.env.DEV });
  for (const [name, value] of Object.entries(headers)) result.response.headers.set(name, value);
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [withSecurityHeaders] }));
