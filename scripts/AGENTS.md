# Scripts (`scripts/`)

## Overview

Node ESM tooling for dev, build, database migration and preview QA. Most logic lives in small pure modules (`*-plan.mjs`, `*-verdict.mjs`, `write-atomic.mjs`) so it can be unit tested with `node:test`. The thin runners (`migrate.mjs`, `preview.mjs`, `browser-smoke.mjs`) call into them.

## Key files

| File | Owns |
|---|---|
| `with-app-env.mjs` | Wrapper for `dev`, `build` and `preview`. Merges `VITE_` keys from `.grok/app-env.json` into the environment; a real `process.env` value wins |
| `app-env-plugin.mjs` | Dev only `/__app-env` endpoint that reports the resolved env |
| `check-auth-invariant.mjs` | Compares dev and build `VITE_AUTH_ENABLED` (`npm run check:auth`) |
| `migrate.mjs` | Deploy time migrator for Postgres (`pg`); skips when `DATABASE_URL` is unset |
| `migration-plan.mjs` | Shared ordering and filtering of migration files, used by `migrate.mjs` and `src/lib/db.ts` |
| `preview.mjs` | Owns port 8081 (built output preview); reads `/proc`, so Linux only |
| `browser-smoke.mjs` | Playwright smoke run with guards (`browser-guard.mjs`) and a verdict (`browser-smoke-verdict.mjs`) |
| `brand-check.mjs` | Checks the share card and `src/lib/og/site.json` |
| `grok-pwa-plugin.mjs`, `grok-pwa-shared.mjs` | PWA head tags and the `?install=1` page for dev; `server/middleware/grok-pwa.ts` is the deployed half |
| `sign-out-plan.mjs` | Pure sign out sequence used by `src/lib/auth/client.ts` |

## Commands

```bash
npm test                              # runs node:test over scripts/**/*.test.mjs, then the src/lib tests
node --test scripts/<name>.test.mjs   # one script's tests
```

## Conventions

- Tests sit beside the module as `<name>.test.mjs`. Only `scripts/` is covered by the `node --test` glob, so logic needed by `src/` and worth testing stays here as a pure module.
- Files are plain `.mjs` and are type checked through `checkJs` when imported from `src/`. Add `// @ts-check` or a `.d.mts` file when you share one.
- The migrator and the PGLite startup path must stay behaviorally identical (same file filter, same atomic apply and record). Change `migration-plan.mjs` for both, not one.

## Gotchas

- `startup.sh` at the repo root assumes the sandbox path `/workspace` and uses `/tmp`. It is not meant for a Windows machine.
- `preview.mjs` and the smoke output path guard assume the Linux sandbox. They will not work as is on Windows.
- Running `vite` directly skips `with-app-env.mjs` and can make dev and build disagree on sign in.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
