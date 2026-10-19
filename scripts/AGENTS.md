# Scripts (`scripts/`)

## Overview

Node ESM tooling for dev, build, the local proxies and preview QA. Most logic lives in small pure modules (`*-plan.mjs`, `*-verdict.mjs`, `write-atomic.mjs`) so it can be unit tested with `node:test`. The thin runners (`preview.mjs`, `browser-smoke.mjs`, `enter-check.mjs`) call into them.

## Key files

| File | Owns |
|---|---|
| `with-app-env.mjs` | Wrapper for `dev`, `build` and `preview`. Merges `VITE_` keys from `.grok/app-env.json` into the environment; a real `process.env` value wins |
| `app-env-plugin.mjs` | Dev only `/__app-env` endpoint that reports the resolved env |
| `auth-proxy.mjs` | The one `/api/auth` proxy options object (target, forwarded host headers, cookie domain), read by `vite.config.ts` as `server.proxy` (spec 0007) |
| `auth-proxy-preview.mjs` | The same proxy as a preview only Vite plugin, because the Cloudflare plugin answers before `preview.proxy` is reached |
| `funnel-local.mjs` | Dev only: serves the funnel's built files (`apps/joining/dist`) at `/dhiinterviews`, `/_astro` and `/s`, adds `dashboardUrl` to the funnel's config file, and proxies the funnel's other `/api/*` routes, so the house and the interview share `localhost:8080` (spec 0008) |
| `deploy-house.mjs` | `pnpm deploy:house`: builds the house with the production Convex address and the test sign in off, refuses a build that holds the development address or an enabled test sign in, removes `.dev.vars`, then `wrangler deploy` (extra arguments go to wrangler, e.g. `--dry-run`) |
| `enter-check.mjs` | `pnpm enter:check`: real browser proof of the front door for an adult and an under 18 student; refuses production, any non local address, and a funnel build (`apps/joining/dist`) made for production |
| `consent-check.mjs` | `pnpm consent:check`: real browser proof of the consent flow (spec house/0005): an under 18 student joins, agrees after the notice, waits for the school, the admin records the parent's consent, then Your data (sharing, download, withdraw, restore) and erase with the 30 day neutral refusal. Same guards as `enter:check`; needs `ERASURE_HASH_SECRET` on the development deployment |
| `check-catalog.mjs` | Fails when a library in the `catalog:` list of `pnpm-workspace.yaml` is pinned directly in a part. Its short exception list is a constant in the script. Runs from `pnpm lint` |
| `responsive-sweep.mjs`, `responsive-verdict.mjs` | Phone, tablet and desktop width sweep of the house rooms (`pnpm responsive:sweep`) and its pure verdict |
| `preview.mjs` | Owns port 8081 (built output preview); reads `/proc`, so Linux only |
| `browser-smoke.mjs` | Playwright smoke run with guards (`browser-guard.mjs`) and a verdict (`browser-smoke-verdict.mjs`) |
| `brand-check.mjs` | Checks the share card and `src/lib/og/site.json` |
| `grok-pwa-plugin.mjs`, `grok-pwa-shared.mjs` | PWA head tags and the `?install=1` page for dev (the old deployed half under `server/` is gone) |

## Commands

```bash
pnpm test:house                       # runs node:test over scripts/**/*.test.mjs, then the src/lib tests (root `pnpm test` also runs every other part)
node --test scripts/<name>.test.mjs   # one script's tests
```

## Conventions

- Tests sit beside the module as `<name>.test.mjs`. Only `scripts/` is covered by the `node --test` glob, so logic needed by `src/` and worth testing stays here as a pure module.
- Files are plain `.mjs` and are type checked through `checkJs` when imported from `src/`. Add `// @ts-check` or a `.d.mts` file when you share one.
- The dev and preview proxies share one options object (`auth-proxy.mjs`), so they cannot drift. The funnel's local serving mirrors spec 0004's route table and never reaches a build (`configureServer` only).
- After a funnel change, run `pnpm --filter dhirise build` so the dev server serves the new pages.

## Gotchas

- `startup.sh` at the repo root assumes the sandbox path `/workspace` and uses `/tmp`. It is not meant for a Windows machine.
- `preview.mjs` and the smoke output path guard assume the Linux sandbox. They will not work as is on Windows.
- Running `vite` directly skips `with-app-env.mjs` and can make dev and build disagree on sign in.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
