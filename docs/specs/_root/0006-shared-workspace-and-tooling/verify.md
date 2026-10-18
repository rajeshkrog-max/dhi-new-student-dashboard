# Verify: shared workspace and tooling · spec 0006 · updated 2026-10-18
_Steps derived from spec 0006 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Open a pull request (or push a branch) on GitHub and watch the CI run → both matrix jobs (Node 22.19.0 and 24) finish green, and a failing run shows as `fail` on the pull request → AC-9 (PR #1: run 2 green on both; run 1 was red on a real engines failure, shown on the PR as `fail`)
- [ ] Push a deliberately broken type to the pull request branch (then revert it) → both CI jobs turn red → AC-9
- [ ] In the Grok sandbox run `sh startup.sh` (`startup.sh` installs the pinned pnpm itself if it is missing) → the house answers on port 8080, and the log in `/tmp/app-startup.log` shows the pinned pnpm version → AC-12
- [x] Run `pnpm test` once from PowerShell and once from Git Bash on Windows 11 → the same result in both → AC-11
- [ ] In GitHub settings turn on branch protection for `main` and require the CI check → a failing run blocks the merge → AC-9

## Commands
- [x] `rm -rf node_modules apps/joining/node_modules && pnpm install` → one `pnpm-lock.yaml` at the root, no `package-lock.json`, no `apps/joining/pnpm-lock.yaml` → AC-1
- [x] `pnpm dev`, then open `http://localhost:8080/` → HTTP 200, started through `scripts/with-app-env.mjs` → AC-2
- [x] `pnpm dev:joining`, then open `http://localhost:4321/dhiinterviews/landing.html` (use `localhost`, Astro does not bind `127.0.0.1`) → HTTP 200 → AC-2
- [x] `pnpm build:all` → the house builds (its migration step skips without `DATABASE_URL`) and the funnel builds 17 pages, with no `.env` file present in `apps/joining` → AC-3
- [x] `pnpm typecheck && pnpm lint && pnpm test`, with no `.grok` folder → all pass; lint shows warnings but 0 errors; 8 house tests skip with the reason ".grok/... is not in a fresh checkout" → AC-4
- [x] `node --test scripts/grok-pwa-plugin.test.mjs` with the real `src/lib/og/site.json` (title "DHI") → all share card tests pass, so they do not depend on the project's own branding → AC-4
- [x] Break a type in `apps/joining/src/lib/local.ts` and run `pnpm typecheck` (then undo) → it fails and names the funnel → AC-4
- [x] `pnpm exec prettier --check apps/joining/package.json` → "All matched files use Prettier code style" (the file is ignored, not checked) → AC-5
- [x] `pnpm exec eslint apps/joining/convex/auth.ts` → reports the file as ignored by a pattern → AC-5
- [ ] On a clean tree run `pnpm format`, then `git status --short -- apps packages` → nothing under those folders changed (review the house diff separately, 53 house files are not Prettier formatted today) → AC-5
- [x] Change `vite` in `apps/joining/package.json` from `catalog:` to `8.3.3`, run `node scripts/check-catalog.mjs` (then undo) → exit 1 naming `apps/joining` and `vite` → AC-6
- [x] `node --test scripts/check-catalog.test.mjs` → 8 tests pass → AC-6
- [x] In a scratch project with the same settings, add `es5-ext@0.10.62` and run `pnpm install` → fails with `ERR_PNPM_IGNORED_BUILDS` naming the package → AC-7
- [x] `pnpm config get minimumReleaseAge` and `pnpm config get engineStrict` → `1440` and `true` → AC-7
- [x] `node -p "require('./package.json').packageManager + ' ' + require('./package.json').engines.node"` and `cat .node-version` → `pnpm@12.10.1 >=22.19.0` and `24`; the CI file uses the same matrix floor → AC-8
- [x] `pnpm install --frozen-lockfile` → "Lockfile is up to date" → AC-1
- [x] `git diff --stat -- apps/joining` → only `package.json`, the removed `pnpm-lock.yaml` and `pnpm-workspace.yaml`, and the two `AGENTS.md` doc edits → AC-10
- [x] `pnpm --filter dhirise test` → 888 tests pass; `pnpm --filter dhirise exec convex --version` and `exec wrangler --version` resolve. No `deploy:*` runs → AC-10
- [x] Compare the funnel's direct dependencies with the old lockfile (`git show 41caeb6:apps/joining/pnpm-lock.yaml`) → all 14 identical (astro 7.3.7, convex 1.46.0, wrangler 4.148.0 and so on) → AC-10
- [x] `pnpm why nf3` → one version, `0.3.17`, so the override in `pnpm-workspace.yaml` is honoured → AC-7

## Value sourcing (one step per source in the spec)
- [x] Catalog versions: `pnpm list better-auth vite --depth 0 -r` → the house and the funnel both show `better-auth 1.6.33` and `vite 8.3.3` → AC-6
- [ ] Which pnpm runs: remove the global pnpm shim and run `corepack`-free `pnpm -v` from the repo → resolves to the version in `packageManager` → AC-8
- [x] Which packages may run build scripts: `allowBuilds` in `pnpm-workspace.yaml` lists only `esbuild` and `workerd`, each with a reason → AC-7
- [x] Which paths lint and format touch: `grep -n "lint:house\|\"format\"" package.json` → explicit path lists, and `.prettierignore` lists `apps/` and `packages/` → AC-5
- [x] Which parts run from the root: `pnpm typecheck` output shows `tsc --noEmit` twice (house, then funnel) → AC-4
- [x] CI action versions: `grep -c "@[0-9a-f]\{40\}" .github/workflows/ci.yml` → `3`, and no `uses:` line without a SHA → AC-9

## Acceptance-criteria coverage
- AC-1 … covered by steps 1 and 15 · AC-2 … 2 and 3 · AC-3 … 4 · AC-4 … 5 and 6 · AC-5 … 7, 8, 9 · AC-6 … 10, 11 and the catalog value step · AC-7 … 12, 13 and 19 · AC-8 … 14 and the pnpm value step · AC-9 … the CI and branch protection manual steps · AC-10 … 16, 17, 18 · AC-11 … the Windows manual step · AC-12 … the sandbox manual step
