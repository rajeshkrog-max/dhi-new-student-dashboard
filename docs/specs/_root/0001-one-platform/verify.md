# Verify: backend and shared code moved into packages · spec 0001 (phase 1) and child 0002 · updated 2026-10-18
_Steps derived from scope row 16, "Done when", and spec 0002's value sourcing table. Spec 0001 has no numbered acceptance criteria, so the clauses are labelled D1 to D5 here. `/check verify` runs these; `/test` locks the durable ones._

**The clauses (row 16, "Done when"):**
- **D1**: `packages/backend/` and `packages/engine/` exist with the funnel's tests passing unchanged.
- **D2**: only the backend package runs `convex dev` and `convex deploy`.
- **D3**: the funnel imports its generated API through a named package export.
- **D4**: the funnel's engine scripts are served at the same public addresses.
- **D5**: nothing is deployed to production, and the old `convex/` folder is gone so nothing can push a stale tree.

## UI / manual
- [x] Start `pnpm --filter @dhi/backend dev` and `pnpm dev:joining`, open http://localhost:4321/dhiinterviews/landing.html, sign in as a test student, answer all 18 questions and finish → the report page draws, and the result is the same style and areas as before the move (the server scored it with the shared engine) → D1, D3, D4 [verified 2026-10-18 by Playwright (signin, results, challenge specs) on the dev deployment, not by hand; the dev watcher itself was not started]
- [x] In the browser network panel on a question page, open `/dhiinterviews/js/engine/questions.js` and `/dhiinterviews/js/engine/score.js` → both load with status 200 from the same addresses as before the move → D4 [verified 2026-10-18: GET on a real dev server returned 200 for both, same byte sizes as packages/engine]
- [x] Open the leaderboard page as a signed in test student → it loads (the generated API reaches `challenge.leaderboard`) → D3 [verified 2026-10-18: e2e/leaderboard.spec.ts passed]
- [x] On the dev deployment, run the 5 minute job by hand: in `packages/backend`, `npx convex run challengeBoard:run '{}'` → it succeeds, with no "not a Convex project" error → D2 [verified 2026-10-18: challenge and leaderboard specs run challengeBoard:run through packages/backend and passed]
- [ ] Follow `apps/joining/tools/WINNER-REVIEW.md` step 3 on the dev deployment only: `node tools/winner-csv.mjs review-test.csv` from `apps/joining`, then delete the file → the file is written (it calls Convex in `packages/backend` for you) → D2

## Commands
- [x] `pnpm install --frozen-lockfile` from a clean checkout → succeeds, and `pnpm-lock.yaml` lists `packages/backend` and `packages/engine` → D1
- [x] `pnpm typecheck` → the house, `dhirise`, `@dhi/backend` and `@dhi/engine` all pass → D1
- [x] `pnpm test` → the house, `dhirise` (25 files, 317 tests) and `@dhi/backend` (24 files, 575 tests) all pass; the old funnel total was 888 tests, now 892 (3 new engine copy tests, 1 split check) → D1 [575 backend + 317 funnel tests, all passed]
- [x] `pnpm lint` and `pnpm build:all` → both pass, and the Astro build finishes with no `.env` values → D1, D4
- [x] `git ls-files apps/joining/convex` → prints nothing, and `ls apps/joining/convex` fails because the folder is gone → D5
- [x] `rg -n "convex (dev|deploy)" apps/joining/package.json package.json` → no match; the only matches in any `package.json` are the `dev`, `dev:once` and `deploy:convex` scripts of `packages/backend/package.json` → D2 [checked with grep: only the three backend scripts match]
- [x] `pnpm --filter dhirise deploy:pages` is NOT run here. Read `apps/joining/package.json` → `deploy:pages` is only `wrangler pages deploy dist --project-name dhirise --branch main`, with no `convex deploy` in it (the spec's split) → D2, D5 [read only, as written]
- [x] `node apps/joining/scripts/sync-engine.mjs --check` after deleting `apps/joining/public/dhiinterviews/js/engine/score.js` → exits 1 and names the file; `pnpm --filter dhirise sync:engine` then fixes it → D4
- [x] In `apps/joining/dist/dhiinterviews/js/engine/` after `pnpm build`, `cmp` each of `score.js` and `questions.js` with `packages/engine/` → identical → D4
- [x] Break the type on purpose: change `dhiStart: number` to `string` in `packages/engine/result.ts`, run `pnpm --filter dhirise typecheck` → it fails in `src/lib/session.ts` (the `ResultView` guard), then revert → D1 [7 type errors in src/lib/session.ts, then reverted]
- [x] `grep -rn "apps/" packages/*/convex packages/*/tests packages/*/*.ts` finds no import or file read of an app (comments aside) → the package never reads an app → D1 [no app import or read found]
- [x] `pnpm --filter @dhi/backend dev:once` with `packages/backend/.env.local` pointing at the dev deployment → "Convex functions ready", and the target line names the dev deployment, not `abundant-caiman-975` → D2, D5 [run once at build time, 15:17, after the owner agreed; target proper-camel-616]

## Value sourcing coverage (spec 0002)
- [ ] Backend deploy, "which deployment is targeted": clear `CONVEX_DEPLOYMENT` in `packages/backend/.env.local` and run `pnpm --filter @dhi/backend dev:once` → the CLI refuses or asks you to pick a project; it never silently falls back to production. Then restore the line → source is the backend package's `.env.local`, plus the deploy guard
- [x] Production versus other environments: with `.env.local` on dev, `pnpm --filter @dhi/backend deploy:convex` is NOT run. Read the script → it sends `PUBLIC_CONVEX_URL` to the funnel build only from the deployment `convex deploy` targeted, and a production target needs `CONVEX_DEPLOY_KEY` plus the owner's fresh yes this session → source is the Convex deployment named in the environment [read only, as written]
- [x] Any signed in call, "who the person is": `pnpm --filter @dhi/backend test` still passes `api-surface` and `students` checks, and `apps/joining/tests/api-surface.test.js` passes → no function takes a student id, email or auth user id as input (unchanged by the move) [api-surface and students checks passed in the full test run]

## Acceptance-criteria coverage
- D1 … covered by steps: sign in and finish; `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm test`; `pnpm lint` and `pnpm build:all`; the deliberate type break; the no app imports grep
- D2 … covered by steps: `challengeBoard:run`; `winner-csv`; the `convex (dev|deploy)` search; reading `deploy:pages`; `dev:once` to dev; the deploy target value sourcing rows
- D3 … covered by steps: sign in and finish; the leaderboard page
- D4 … covered by steps: the two script addresses; `sync-engine --check`; `cmp` of the built scripts; `pnpm lint` and `pnpm build:all`
- D5 … covered by steps: `git ls-files apps/joining/convex`; reading `deploy:pages`; `dev:once` naming the dev deployment
