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


---

# Verify: sign in, save an answer, read it back · spec 0007 · updated 2026-10-18
_Steps derived from spec 0007 acceptance criteria AC-1 to AC-16 and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones. Ticked steps were run on 2026-10-18 against the development deployment `proper-camel-616`; the note says how. Open steps could not be run yet and say why._

## UI / manual
- [ ] On `http://localhost:8080/thread` tap **Continue with Google**, choose a real test Google account, finish → you come back to `/thread` signed in (profile step, or question 1 if you already have a profile) → AC-2 [open: the redirect address is added and Google accepts it (the button reaches Google's sign in page with `redirect_uri=http://localhost:8080/api/auth/callback/google` and no mismatch error), but the round trip with a real account has not been seen. Needs you.]
- [x] Sign out of everything, open `/thread` → a Google button, and the test form because the build flag is on; no name, age or answer is drawn → AC-1 [scripts/thread-check.mjs, both students]
- [ ] Open `/thread` on a throttled network (browser devtools, Slow 3G) → a neutral "Loading…" view shows first, never the signed out view while the token is still loading → AC-1, value sourcing "Loading and signed out views" [open: only the end states were checked by script]
- [x] Sign in with the test form, fill the profile with age 25 → no guardian tick is shown, the name is pre filled from the account, and question 1 shows four options in written order (`q1o1` to `q1o4`) → AC-3, AC-4 [scripts/thread-check.mjs, adult]
- [x] Sign in as a new test student, age 15, tick consent but not the guardian box, press Continue → a plain message about a parent or guardian, focus moves to that box, name and age are kept; ticking it lets you continue → AC-3, AC-9 [scripts/thread-check.mjs, minor; also by hand in the browser panel]
- [ ] On the profile step, read the consent lines → they are word for word `CONSENT_LINES` from `packages/backend/convex/consentText.ts` at the current version → AC-3, value sourcing "Consent lines shown" [open: the script does not compare the words]
- [x] Tap option 2, reload the page → option 2 is still selected; the answer is not in `localStorage` or `sessionStorage` → AC-4, AC-5 [script]
- [x] Tap option 3, then tap option 3 again, reload → only option 3 is selected → AC-6 [script; the one row per question rule is also the existing `checks.test.ts` "same option again is a no op" test]
- [x] Go offline (devtools), tap option 4 → within about 10 seconds a retry message shows and option 4 stays chosen; back online it saves → AC-9 [script, `context.setOffline`]
- [x] With the check finished (the script saves all 18 answers and calls `checks.complete`), open `/thread` → the saved answer, the note that the check is finished, and no radio buttons → AC-7 [script, adult]
- [x] Block the sign out request (devtools) and press Sign out → a plain message, and you are still signed in → AC-8 [script]
- [x] Press Sign out normally, then reload → the signed out view, and it stays so → AC-8 [script, both students]
- [x] Set the session cookie to a made up value and reload → the signed out view, and `students.me` is not asked for → AC-1, AC-9 [script, minor, reads the websocket frames]

## Commands
- [x] `pnpm thread:check` with `pnpm dev` running → every step passes for both students (23 checks), exit 0 → AC-16
- [x] `pnpm thread:check --short` → 6 checks pass (AC-1, AC-2, AC-4, AC-5) → AC-16
- [x] Build the house (`pnpm build`), serve it with `pnpm preview --port 8080 --host localhost`, then `pnpm thread:check --short --url http://localhost:8080` → passes → AC-12, AC-16 [run 2026-10-18 after spec 0007 was updated: `/api/auth` goes through `authProxyPreviewPlugin` (not `preview.proxy`); the short run passed, and so did the full run on the Worker]
- [x] `node --test scripts/auth-proxy-preview.test.mjs` → 7 tests: only `/api/auth` and `/api/auth/...` taken, query kept, `/api/authx` left to the app, a forged forwarded host replaced, `Origin` unchanged, two cookies kept with `Domain` stripped, a redirect passed, 502 with an empty body when the backend is down, nothing registered and one warning when `CONVEX_SITE_URL` is unset → AC-12, AC-15
- [x] On the Worker preview: `curl http://localhost:8080/api/auth/get-session` → 200 from the backend; `curl http://localhost:8080/api/authx` → the app's own 404 → AC-12
- [x] `pnpm --filter @dhi/backend test` → 25 files, 586 tests pass, including `trustedOrigins.test.ts` (11 tests) → AC-10, AC-6
- [x] Send forwarded host headers straight to the dev `.convex.site` address (`localhost:4321`, `localhost:8080`, `dhirise.com`, none) → all 200; `evil.example` and `localhost:9999` → 403 → AC-10 [curl, after the push]
- [x] `pnpm --filter dhirise exec playwright test e2e/signin.spec.ts` (the funnel's own sign in suite on `localhost:4321`, same dev deployment) → 13 of 13 pass with the new origins list → AC-10, AC-14
- [x] `pnpm typecheck:house`, `pnpm lint:house`, `pnpm test:house` → pass (lint: 0 errors, 3 old warnings) → AC-11
- [x] Search `src scripts vite.config.ts` for imports of `pg`, `kysely`, `jose`, `@electric-sql/pglite`, `lib/db`, `migration-plan`, `sign-out-plan`, `check-auth-invariant` and the removed `src/lib/auth/*` files → nothing found; `migrations/` and `server/` are gone → AC-11
- [x] `pnpm typecheck` (house, funnel, backend, engine) → all four pass; `pnpm lint:house` loads `typescript-eslint` without error → AC-13 [TypeScript 7 made `typescript-eslint` stop with "does not support TS 7.0"; the house and the two shared packages are pinned to 6.0.3, the funnel was not touched]
- [x] `git status --short apps/joining` → prints nothing → AC-14
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (house 180 + 40, backend 586, funnel 317) and `pnpm build:all` with no `.env.local` → all pass → AC-14 [one earlier `pnpm test` run had four 5 second timeouts on cold start under load; two reruns were fully green]
- [x] Search `dist/client` for the secret NAMES and for the VALUES of `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `SHARE_LINK_SECRET`, `REPORT_RENDER_SECRET`, `CLOUDFLARE_API_TOKEN` read from the dev deployment → no value anywhere; the only name found is `BETTER_AUTH_SECRET` inside Better Auth's own env name table (`U(e)` reads `process.env`, which is `{}` in a browser) → AC-15
- [x] Clean build with no `.env.local`: search `dist/client` for `Test sign in (this build only)`, `VITE_TEST_SIGNIN`, `proper-camel-616` → none found, so the test form is off by default → AC-15
- [x] Build with `.env.local`: search `dist/client` for `proper-camel-616.ap-southeast-2.convex.cloud` (present), `proper-camel-616.ap-southeast-2.convex.site` and `CONVEX_SITE_URL` (absent) → only `PUBLIC_CONVEX_URL` and `VITE_TEST_SIGNIN` reach the client → AC-15

## Value sourcing coverage (spec 0007)
- [x] Load `/thread`, "signed in or not": a signed out visit sends no `students:me` frame; after sign in it does → source is `students.me`, the page sends nothing → AC-1
- [ ] Google sign in, "callback address": complete a real Google sign in and read the redirect address in the browser bar → `http://localhost:8080/api/auth/callback/google` [open, owner step]
- [x] Any sign in call, "cookie origin and base address": vary the forwarded host (list member, stranger, none, own deployment host) and an unset list in unit tests → list member uses that host, stranger gets 403, none uses `BETTER_AUTH_URL`, unset list changes nothing → source is the forwarded host header checked against `BETTER_AUTH_TRUSTED_ORIGINS`
- [x] Any Convex call, "the signed in token": the page calls Convex only after `/api/auth/convex/token` gave a token, and a made up cookie gives the signed out view → source is the Better Auth Convex client plugin
- [x] Show the test form, "visible or not": flag on shows the form, clean build removes it → source is `VITE_TEST_SIGNIN`; the server still decides with `TEST_SIGNIN_ENABLED`
- [x] Profile step, "name default / age / guardian tick / class choices": Google name shows pre filled; age 25 shows no tick, age 15 shows it; the six labels equal the schema's → sources are `googleName`, what is typed, six fixed labels
- [x] `createProfile`, "consent version and hash": a profile saves with `CONSENT_VERSION` and its hash (no `consent_text_changed`) → source is `@dhi/backend/consentText`
- [x] Question block and `saveAnswers`: question text and option ids come from `DhiQuestions.question(1)`, `q` is 1, `optionId` is the tapped option, `answeredAt` is the device time and the server cuts a future time down (existing `checks.test.ts`) → AC-4
- [x] Read back and finished note: the selected option and the finished note come only from `students.me` (`check.answers.q1`, `check.completedAt`) → AC-5, AC-7
- [x] Sign out, "page cleared or not": cleared only on a successful response, kept with a message when blocked → AC-8
- [x] Dev and preview proxy, "forwarded host and proto": `scripts/auth-proxy.test.mjs` checks all four headers, the stripped cookie domain and redirects passed through for the one shared object → AC-2 [the preview half is open, see Commands]
- [x] Retry message, "connection down or save pending": offline run shows it, `plain-words.test.ts` checks the exact 10 second rule (exactly 10 seconds is not yet more than 10) → AC-9
- [x] Test run values: a new `thread-<epoch>-<random>@example.test` per run, a constant password and `Class 10`, ages 25 and 15, and the finished check made through a Node Convex client with a token from `/api/auth/convex/token` → AC-16

## Acceptance-criteria coverage
- AC-1 … covered by steps: signed out view; throttled network (open); stale cookie; the "signed in or not" row
- AC-2 … covered by steps: real Google sign in (open, owner step); test sign in sets the cookie on `localhost:8080`; proxy headers
- AC-3 … covered by steps: adult profile; under 18 refusal; consent lines (open)
- AC-4 … covered by steps: tap and save; question block row
- AC-5 … covered by steps: reload shows the choice, no browser storage
- AC-6 … covered by steps: change then same twice; `checks.test.ts`
- AC-7 … covered by step: finished check
- AC-8 … covered by steps: blocked sign out; normal sign out and reload
- AC-9 … covered by steps: under 18 refusal in plain words; offline retry; stale cookie; `plain-words.test.ts`
- AC-10 … covered by steps: backend tests; forwarded host curls; the funnel's sign in suite
- AC-11 … covered by steps: removed imports search; `typecheck:house`, `lint:house`, `test:house`
- AC-12 … covered by steps: Worker build and short run on `localhost:8080`; `auth-proxy-preview.test.mjs`; the `/api/auth` and `/api/authx` curls
- AC-13 … covered by step: `pnpm typecheck` and `lint:house` on TypeScript 6.0.3 (the result and reason are now written in spec 0005)
- AC-14 … covered by steps: `git status` of `apps/joining`; root `typecheck`, `lint`, `test`, `build:all`; the funnel's sign in suite; dev deployment only
- AC-15 … covered by steps: secret names and values search; clean build; with `.env.local` build
- AC-16 … covered by steps: `thread:check` full and `--short` on the dev server, and the short and full runs on the Worker build

# Verify: interview first entry and a challenge with no end date · spec 0008 · run 2026-10-18
_Spec 0008 (`Assumed`) replaced the `/thread` proof page of spec 0007 the same day, so 0007 AC-1 to AC-9 and AC-16 described a page and a script that no longer exist. They are listed as superseded below, and the same sign in, save and read back path was run on the new surfaces. Everything here was run on the dev server (`localhost:8080`, started by `pnpm dev`) against the development deployment `proper-camel-616`, with throwaway test accounts._

## UI / manual
- [x] Open `/enter` signed out → the Enter screen with the Google button and the test form, no student text → 0008 requirement 3 [run: path `/enter`, form and Google button present, no student name on the page]
- [x] Sign in a brand new test account from the form → lands on `/dhiinterviews/landing.html` → 0008 requirement 1 [run: path read after sign in]
- [x] Create the profile only (under 18 with the guardian tick), open `/enter` → lands on the interview again → 0008 requirement 1 [run]
- [x] Answer all 18 and finish, open `/enter` → lands on `/dashboard` with the student's own name and initials, and no demo name → 0008 requirement 2 [run: "Verify Student", initials VS, no "Suzzy"]
- [x] Open the phone drawer → the class ("Class 10") shows with the name → 0008 requirement 2 [run]
- [x] Save the phone step, open the report → "Go to your dashboard" sits above the footer and points to `/dashboard`; click it → the dashboard opens → 0008 [run]
- [x] Press Leave on the dashboard → the session is gone (`/api/auth/get-session` answers `null`) and the page returns to `/enter`; open `/dashboard` signed out → goes to `/enter` → 0008 requirement 3, 0007 AC-8 intent [run]
- [x] `/challenge.html` and `/leaderboard.html` with no end date → no countdown, no "Ends" rule, no time left chip → 0008 requirement 4 [run earlier the same day: clock hidden with no children, rule hidden, chip hidden]
- [ ] Real Google sign in through `/enter` returns signed in → 0007 AC-2 [the owner saw Google sign in work from the old Enter screen; the loop through `/enter` itself was seen only with the test form]

## Commands
- [x] `curl -H "x-better-auth-forwarded-host: evil.example" <dev site>/api/auth/get-session` → 403; with `localhost:8080` → 200 → 0007 AC-10 [run]
- [x] `pnpm preview` (the built Worker) → `/enter` 200, `/dashboard` 200, `/api/auth/get-session` 200, `/api/authx` 404, `/thread` 404 → 0007 AC-12 (the Worker still builds and still forwards `/api/auth`) [run; stopped afterwards]
- [x] `pnpm typecheck`, `pnpm lint` (3 old warnings, 0 errors), `pnpm test` (house 186 and 34, backend 589, funnel 317), `pnpm build:all` → 0007 AC-11, AC-13, AC-14 (except the funnel edits, see below) [run]
- [x] Search the house for Postgres, PGLite, Kysely, `jose`, Nitro and Grok imports → none in code; only the stale `src/lib/auth/AGENTS.md` text mentions them (`/sync`) → 0007 AC-11 [run]
- [x] Search the built client for Google and Better Auth secrets → no value; the one name hit is Better Auth's own library reading `BETTER_AUTH_SECRET` from the environment, which has no value in a browser → 0007 AC-15 [run]
- [x] `pnpm --filter @dhi/backend exec vitest run` → 589 pass, including no end date at any date and the old date rules when `CHALLENGE_ENDS_AT` is set → 0008 requirement 4 and 5 [run]

## Superseded by spec 0008 (not run, the surface is gone)
- 0007 AC-1 to AC-9 (the `/thread` page): replaced by the `/enter` and `/dashboard` runs above. The save of one answer and the read back after a reload are now done by the funnel's own interview, which saves answers through the same `checks.saveAnswers` and reads them through `students.me`.
- 0007 AC-16 (`pnpm thread:check`): the script was removed with the page. A repeatable replacement for the new flow is owed to `/test`.
- 0007 AC-14 "no file under `apps/joining/` is edited": the owner asked for the deadline and the dashboard button, so 12 funnel files changed (no production command was run, and the Convex push went to the development deployment only).

## Acceptance-criteria coverage (spec 0008)
- Requirement 1 (no data or unfinished goes to the interview) … covered by the brand new and profile only runs
- Requirement 2 (finished goes to the dashboard with name and class) … covered by the finished account runs
- Requirement 3 (signed out sees only the sign in screen) … covered by the signed out run and the Leave run
- Requirement 4 (no end date) … covered by the challenge page run and the backend suite
- Requirement 5 (a set date keeps the old rules) … covered by the backend suite only; not run in a browser
