# 0004. Shared host and routing: Cloudflare Workers, one domain split by path

## Summary

Both parts run on Cloudflare Workers under one dhirise.com address. The funnel moves from Cloudflare Pages to a Worker that serves its static files and forwards `/api/*` to Convex. The house is a second Worker. At cutover the funnel Worker takes the whole domain. When the house ships, Worker routes keep `/dhiinterviews*`, `/s/*`, `/api/*` and `/_astro/*` with the funnel and send every other path to the house. The Pages project stays untouched as the fallback until the move is proven. (basis: Cloudflare says to start new projects on Workers, and Pages is still supported)

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): Cloudflare for both, the funnel moves to Workers now.

**What is decided**:
- **Two Workers.** `dhirise` (funnel): Astro static output as Workers static assets, plus a small Worker script for `/api/*`. `dhirise-house` (house): TanStack Start built with the Cloudflare Vite plugin and Wrangler, which is the official Cloudflare route for that framework.
- **Routes, two stages.** At cutover the funnel Worker takes `dhirise.com/*`, so `/` keeps redirecting to the landing page as today and the funnel's root files (`/_astro/*`, `/404.html`) stay with it. When the house ships, the funnel keeps these specific routes: `dhirise.com/dhiinterviews*` (the star with no slash also catches `/dhiinterviews` with no trailing slash, which `_redirects` sends to the landing page), `dhirise.com/s/*`, `dhirise.com/api/*` and `dhirise.com/_astro/*`. `dhirise.com/*` then moves to the house Worker, which must serve `/` and keep a `?ref=` query string intact. Specific routes must win over the catch all, which the spike proves.
- **House server routes.** The house never uses `/api/*`. Its server routes use `/app-api/*` (its existing `/api/rtc` moves there).
- **Switch and rollback.** Cutover adds the Worker route. Rollback deletes it. The Pages custom domain and its DNS record stay in place until Pages is retired, so rollback needs no certificate or DNS wait. The spike proves that Worker routes take precedence over the Pages custom domain on this zone.
- **Wrangler asset settings for the funnel Worker.** `run_worker_first = ["/api/*"]` so only the forwarders run the script and everything else is served as a static asset. `not_found_handling = "404-page"` so `404.html` keeps working. `html_handling` is chosen in the spike so that both `/page` and `/page.html` resolve, as they do on Pages. Static assets honour `_headers` and `_redirects` (including 200 rewrites) on asset responses only. The forwarders already set their own headers in code, so that is enough.
- **Forwarders carried over.** The seven Pages Functions in `functions/api/` (`auth`, `avatar`, `files`, `referral`, `render`, `shared`, `team`, plus `health`) become routes in the funnel Worker, with the same checks: key shape before forwarding, GET only where it is GET only today, no cookies where none are sent today, headers set in code.
- **Headers and redirects carried over.** `_headers` (HSTS, `nosniff`, referrer policy, and `Content-Security-Policy: frame-ancestors 'none'` for every path; the fuller policy listed in funnel spec 0001 is still to come, and `/dhiinterviews/team*` and `/s/*` carry their own stricter rules) and `_redirects` (`/` to the landing page, `/s/*` rewrite to `/dhiinterviews/shared`) must behave identically on Workers. If Workers static assets does not honour any of them, the same rule moves into the Worker script.
- **Edge caching rule stays.** Page responses send `no-cache`, scripts and styles keep their fingerprinted addresses (`scripts/version-assets.mjs`), and the picture forwarder keeps its 50 minute edge and 10 minute browser life.
- **Report PDF.** Cloudflare Browser Run stays as is, and the render page is served by the same funnel Worker. `REPORT_RENDER_BASE_URL` points at the public address.
- **Deploys, three scripts.** `deploy:backend` runs `convex deploy` from `packages/backend/` (production needs the deploy guard's fresh explicit consent). `deploy:worker` builds the funnel and runs `wrangler deploy`. `deploy:pages` keeps the old Pages only path (`wrangler pages deploy dist`) working as the fallback until Pages is retired. Cutover day uses `deploy:worker` only. The production backend deploy waits until after the board freezes.
- **Environments.** Two named Wrangler environments: `production` and `staging`. Production uses the production `CONVEX_SITE_URL`. Staging, at `staging.dhirise.com`, and every other build use the development deployment's address. Wrangler environment variables are not inherited, so every variable is repeated per environment. The Worker variables hold public values only.
- **Build address per environment.** `convex deploy --cmd-url-env-var-name` injects only the production Convex URL, so a staging build sets the development `PUBLIC_CONVEX_URL` explicitly.
- **Staging address.** `staging.dhirise.com` is a Worker custom domain for the `staging` environment. It is the target for the browser tests (`pnpm test:e2e`) and `scripts/verify-pages.mjs`, and the development `REPORT_RENDER_BASE_URL` points at it, because Browser Run cannot reach localhost. The avatar edge cache cannot be proven on a `workers.dev` address, so it is proven on the real zone by the synthetic check after cutover.
- **House Worker settings.** `dhirise-house` sets the `nodejs_compat` flag, a compatibility date, `VITE_CONVEX_URL` and `CONVEX_SITE_URL` per environment, and its routes only when it ships. It has no route on the live domain before then.
- **Deploy credentials.** A Cloudflare API token limited to Workers scripts and zone Workers routes, used only to deploy, and kept apart from the Browser Run token that lives in Convex. A production Convex deploy key. Each has its own scope, lives only on the owner's machine or deploy environment, and is never in the repo or in a Worker variable.
- **Logging.** Workers Logs (`observability`) stays off for both Workers in production, because request logs would keep `/s/<code>` bearer links and query strings. Errors are seen through the Convex dashboard and the alerts decided in scope row 5.
- **Cookies and origin.** Same origin for both parts, so no cross address cookie handling is needed.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Any `/api/*` forward | The Convex site address | Worker variable `CONVEX_SITE_URL` per environment |
| A forwarded request | The visitor identity for rate limits | The `x-visitor` header the referral forwarder already adds, from the connecting address |
| Render page | The signed render token | Created by Convex, read from the `#t=` fragment (existing, funnel spec 0006) |
| Which Worker answers a path | The route table above | The Wrangler files and the zone routes |

**Key invariants**:
- Every public address under `dhirise.com/dhiinterviews` is unchanged by the move.
- The Pages project and deployment stay switchable until the team calls the Workers setup stable.
- No secret is in a Worker variable or in the repo.
- A production deploy never happens without fresh explicit consent.

**Security model**: no new permissions. The forwarders only forward and never hold personal data. The headers stay as strict as today. Compliance scope: personal data of minors, so no personal data in Worker logs.

**Configuration required**:
- `CONVEX_SITE_URL`: production and development addresses, per Wrangler environment (existing)
- `PUBLIC_CONVEX_URL`: injected at build (existing)
- `REPORT_RENDER_BASE_URL`: Convex variable, public address of the funnel Worker, `https://dhirise.com` on production and `https://staging.dhirise.com` on development (existing, value changes)
- `VITE_CONVEX_URL`, `CONVEX_SITE_URL` for the house Worker, per environment (new)
- A Cloudflare deploy token and a production Convex deploy key, deploy only, outside the repo (new, see above)

## Short rationale

Both parts are already on Cloudflare, and Browser Run is there, so one host means one account and one place for routing. Cloudflare says to start new projects on Workers, and the house's framework officially targets Workers, so the house cannot sit on Pages at all. Moving the funnel too is your explicit choice. It is riskier than leaving it on Pages until after the challenge, and the staged order and the untouched Pages fallback are what contain that risk. (basis: strangler pattern, new beside old, old kept until proven)
