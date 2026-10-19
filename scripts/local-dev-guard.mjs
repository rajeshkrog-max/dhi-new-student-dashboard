// The safety checks `pnpm enter:check` and `pnpm responsive:sweep` share. Both sign in with the test form and create or reuse test accounts, so
// they must only ever run against this machine and the development backend. The checks are plain functions so they can be tested.
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const PRODUCTION_DEPLOYMENT = "abundant-caiman-975";

export function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1"].includes(hostname);
}

/** The reason a run must stop, or null when it may go on. `envText` is .env.local, `funnelBuilds` the text of the funnel's built scripts. */
export function refusalReason({ url, envText = "", envValue = "", funnelBuilds = [] }) {
  const base = new URL(url);
  if (!isLocalHost(base.hostname)) return `refusing ${base.origin}. It only runs against this machine.`;
  if (envText.includes(PRODUCTION_DEPLOYMENT) || envValue.includes(PRODUCTION_DEPLOYMENT)) {
    return ".env.local points at the production deployment. It only runs against development.";
  }
  if (funnelBuilds.some((text) => text.includes(PRODUCTION_DEPLOYMENT))) {
    return "apps/joining/dist was built for production. Run `pnpm --filter dhirise build` (it uses the development backend) and try again.";
  }
  return null;
}

/** Reads the real files and exits with code 2 when the run is not safe. Returns the address to run against. */
export function assertLocalDevelopment(label, url) {
  const envText = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  // The funnel's built files are served from apps/joining/dist. A production deploy leaves a build there that points at the production backend.
  const distAstro = "apps/joining/dist/_astro";
  const funnelBuilds = existsSync(distAstro)
    ? readdirSync(distAstro)
        .filter((f) => f.endsWith(".js"))
        .map((f) => readFileSync(`${distAstro}/${f}`, "utf8"))
    : [];
  const reason = refusalReason({ url, envText, envValue: process.env.PUBLIC_CONVEX_URL ?? "", funnelBuilds });
  if (reason) {
    console.error(`${label}: ${reason}`);
    process.exit(2);
  }
  return new URL(url);
}
