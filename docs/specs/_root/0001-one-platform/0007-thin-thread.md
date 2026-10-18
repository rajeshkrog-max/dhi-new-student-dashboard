# 0007. The thin thread: sign in, save an answer, read it back, on the shared platform

## Summary

This is the first real proof that the house runs on the shared platform. A test student opens one plain page in the house at `/thread`, signs in with Google (or a test form), fills in the profile step, answers question 1 of the check, and sees the same answer after a reload. It uses the funnel's own backend functions, so no new table and no new backend function is needed. The same pass strips the house's own Postgres and Grok sign in code, builds it for Cloudflare Workers, and proves the live funnel did not change. It is proven on `localhost:8080` against the development deployment only.

## Requirements

**User stories**:
- As a test student, I want to sign in on the house, answer one question and see it again after a reload, so the team knows the house really uses the shared sign in and database.
- As the owner, I want the house to carry no Postgres, PGLite or Grok broker code, so there is one account system and one database.
- As the owner, I want the live funnel left alone, so students taking the check today see no change.

**Acceptance criteria** (the contract, each one independently checkable):
- **AC-1**: A signed out visitor to `/thread` sees a Google button. A test email and password form shows only when the build flag `VITE_TEST_SIGNIN` is `"true"`. Nothing about any student is shown or fetched while signed out. While the token is still loading, the page shows a neutral loading view (not the signed out view), and `students.me` is not called until the page is authenticated.
- **AC-2**: Google sign in on `http://localhost:8080` returns to `/thread` signed in. The session cookie is set on `localhost:8080` through `/api/auth/*`, and the page then holds a Convex token read from `/api/auth/convex/token`.
- **AC-3**: A signed in person with no profile (`students.me` says `needsProfile`) sees a profile step: name (filled from `googleName`, editable), age, class (the six values in the schema), the current consent lines, and a consent tick. Under 18 also needs the guardian tick. Submitting calls `students.createProfile` with the current consent version and hash. A refusal shows a plain message and keeps what was typed.
- **AC-4**: A signed in person with a profile (`ready`) sees question 1 and its four options in written order. Tapping one calls `checks.saveAnswers` with question 1 and that option id.
- **AC-5**: After saving, and after a full reload of the page, the saved choice shows as selected. It is read from `students.me` (`check.answers.q1`), never from browser storage.
- **AC-6**: Changing the choice and saving again replaces the stored answer. Saving the same choice twice leaves one row. There is never more than one stored answer for question 1.
- **AC-7**: If the check is already finished (`completedAt` is set), the page shows the saved answer with a plain note that the check is finished, and offers no save control.
- **AC-8**: Sign out calls Better Auth's sign out and clears the page only after the server says it worked. After that, `/thread` shows the signed out view, and stays signed out after a reload. If the call fails, the page says so and stays signed in.
- **AC-9**: Server refusals become plain words and never show a raw code or personal data: `not_signed_in` forces one token refresh and then returns to the sign in view, `consent_text_changed` asks for a reload, `guardian_required` and `invalid_input` point at the field, `account_conflict` says the address already has an account and to sign in with that one, and a 401 from the token route is treated as signed out. Convex queues writes while offline, so a save never fails by itself: the page shows a retry message when the connection is down or a save has been pending for more than 10 seconds, and keeps the chosen option.
- **AC-10**: The Better Auth trusted origins list works as spec 0003 says: `BETTER_AUTH_TRUSTED_ORIGINS` (comma list, trimmed, lowercased). No forwarded host header: the base address is `BETTER_AUTH_URL`. A forwarded host in the list: the base address is that host. A forwarded host not in the list: the request is refused with a 403. An empty or unset list behaves as the list `[BETTER_AUTH_URL]`, never as a lockout, so production behaves exactly as it does today. `trustedOrigins` always equals the same list. Unit tests cover each case plus mixed case and padding.
- **AC-11**: The house carries no Postgres, PGLite, Kysely, `pg`, Nitro, `jose` or Grok broker code or dependency. Every file named in the Build plan removal list is gone, a search finds no remaining import of them, and `pnpm typecheck:house`, `pnpm lint:house` and `pnpm test:house` pass.
- **AC-12**: `pnpm build` builds the house as a Cloudflare Worker with the Cloudflare Vite plugin, and the built Worker served locally on `localhost:8080` passes AC-1 to AC-9 the same way the dev server does. No deploy script or deploy step is added.
- **AC-13**: The house and the shared packages use one TypeScript version. If the house's lint or type check does not accept the funnel's `^7.0.2`, both stay on the highest version both accept. The version and the reason are written into the table in spec 0005.
- **AC-14**: The live funnel is unchanged: no file under `apps/joining/` is edited, no production deploy command is run, the Convex push goes to the development deployment only, and the root `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build:all` pass.
- **AC-15**: No secret reaches the browser or git. The built client holds only `PUBLIC_CONVEX_URL` and `VITE_TEST_SIGNIN`, and a search of the built client finds no Google or Better Auth secret. `VITE_TEST_SIGNIN` defaults to off, and a clean `build:all` (no `.env.local`) builds with it off. No function receives a student id or email from the page.
- **AC-16**: A repeatable script runs AC-1 to AC-8 in a real browser on the test form, once as an adult and once as an under 18 student with the guardian tick, against the dev server. Against the Worker build it runs a short sign in, save and reload check (AC-1, AC-2, AC-4, AC-5). It exits with an error if any step fails.

## Decision

**Chosen option**: Option 1: prove the real path. Question 1 through the funnel's own `checks.saveAnswers`, on a new `/thread` route, signed in through the shared Better Auth, run locally on the development deployment.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-auth` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-auth/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-env` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-env/`) · `better-auth-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-security-best-practices/`) · `workers-best-practices` (`cloudflare/skills`, `apps/joining/.claude/skills/workers-best-practices/`) · `wrangler` (`cloudflare/skills`, `apps/joining/.claude/skills/wrangler/`)

**What is decided**:
- **The answer.** Question 1 of the 18, option ids `q1o1` to `q1o4`, saved with `checks.saveAnswers` and read back with `students.me`. Nothing new is written to the backend except the trusted origins change (AC-10). (basis: spec 0002, one check per student, answers changed in place)
- **The page.** A new route `src/routes/thread.tsx`. The demo landing page `/`, the demo gate and the nine rooms are not touched, so house row 2 can replace the gate later without a clash.
- **The profile step is real.** The page calls the funnel's `students.createProfile` with the shared consent text, so the under 18 rule is proven in the house too. No fixed test profile, no consent bypass. (basis: spec 0003 key invariants, funnel consent rules)
- **Question text.** The page reads question 1 from `@dhi/engine/questions` and uses only each option's `id` and `text`. It edits nothing in the funnel's interview page, its scripts or the engine file, and it does not shuffle (the shuffle and scoring belong to scope row 7).
- **Sign in controls.** Google always. The test form (email and password) only when `VITE_TEST_SIGNIN` is `"true"`; the server side switch `TEST_SIGNIN_ENABLED` on the development deployment is the real gate.
- **Session reading is client side.** The page uses the Better Auth Convex integration for TanStack Start with the token from `/api/auth/convex/token`, as spec 0003 decided. No server side rendering of signed in pages. The Convex provider is mounted by the `/thread` route only, so the rooms are not wrapped.
- **Token and loading.** `ConvexBetterAuthProvider` with the Better Auth client holds the token; the page keeps no token copy of its own. The `loading` and `signedOut` views come from `useConvexAuth()`, and `students.me` is passed `"skip"` until the page is authenticated. On `not_signed_in` the page forces one token refresh, then shows the signed out view.
- **Test form.** It reuses the Better Auth email routes the funnel's test sign in already uses (`/api/auth/sign-up/email`, then `/api/auth/sign-in/email`), modelled on `apps/joining/src/lib/session.ts`. They work only where `TEST_SIGNIN_ENABLED` is on.
- **Worker preview.** The local Worker build gets the same `/api/auth` proxy as the dev server, through a small preview only Vite plugin, `authProxyPreviewPlugin`, listed before the Cloudflare plugin in `vite.config.ts`. It hands the one shared `authProxy()` object (the same options the dev server's `server.proxy` reads) to `http-proxy-3`, the library Vite itself uses, added to the house as one exactly pinned dev dependency (2.0.1 on 2026-10-18), so redirects, several cookies, streaming and compression behave exactly as in dev and the two cannot drift. It matches `/api/auth` and `/api/auth/...` only (so `/api/authx` is not forwarded), keeps the query string and forwards every method. The forwarded host and proto headers replace whatever the client sent, `Origin` passes through unchanged and `Host` becomes the target's. If `CONVEX_SITE_URL` is unset the plugin registers nothing and prints one warning, so a clean build stays green. If the backend cannot be reached it answers 502 with no detail in the body and logs nothing about the request. It registers its middleware directly in `configurePreviewServer` (not as a returned post hook) and uses `enforce: "pre"`, so its place in the plugin list does not matter. `vite dev` never runs `configurePreviewServer`, so dev keeps using `server.proxy`. It is not `preview.proxy`: building showed (2026-10-18) that Vite adds its own proxy only after every plugin's `configurePreviewServer` hook has run, and the Cloudflare plugin answers every request in its own hook first, so `preview.proxy` is never reached. A plugin that registers its middleware directly, ahead of the Cloudflare plugin, runs first. The plugin lives in the Vite preview server only and is not part of the build output, so the house Worker still never gets its own `/api/*` handler, because the contract in spec 0001 keeps `/api/*` for the funnel. If a request to `/api/auth` on the local Worker still does not reach the development deployment, stop and return to `/architect`. (basis: Vite 8.3.3 preview server order, observed in the build)
- **Where it is proven.** `localhost:8080` with `pnpm dev`, then the Worker build served locally on the same port with `vite preview --port 8080 --host localhost` (run through `scripts/with-app-env.mjs` like the other commands). The config's own preview port 8081 and `scripts/preview.mjs` (Linux only, owns 8081) are not used for this proof, because the forwarded host, the trusted origins list and the Google callback all name `localhost:8080`. The test script uses `localhost:8080` everywhere, never `127.0.0.1`, because cookies belong to the host name. Both fit the four listed sign in origins, so no fifth origin and no deployed address is added. `staging.dhirise.com` and a `workers.dev` address are out of this row.

## Short rationale

The backend already has everything the thread needs: a profile creator, an answer saver and a reader that returns the saved answers. Reusing them proves the path the funnel will run on after the move, and adds no table to remove later. A separate thread table or a free text note would prove less and leave something to delete. A deployed `workers.dev` address was the other way to be "private", but it needs a fifth origin in Google and in the trusted list, which breaks the four origin contract in spec 0001. The real profile step costs one form but is the only way the consent rule for students under 18 is proven in the house. For the local Worker, `preview.proxy` was the first plan but does not work with the Cloudflare plugin (see "Worker preview"). The other two ways were to prove sign in on the Worker only later at the staging address (cheaper, but a Worker only sign in bug would then show up late and AC-12 would be weaker) or to run a second helper Worker under wrangler (closest to production, but a second Worker and its config only for a local check). A small preview only plugin is the least code that keeps AC-12 fully provable. (basis: tracer bullet practice, prove the real path early) (basis: tracer bullet practice, scope header; the four origin contract in spec 0001)

## Feature design

**Data model**: no new table and no migration. The thread uses these existing tables and adds no field.

| Table | Used for | Written by |
|---|---|---|
| `students` | the profile (name, age, class) keyed to the Better Auth user | `students.createProfile` |
| `consents`, `consentTexts` | what was agreed and when | `students.createProfile` |
| `checks` | the student's one check (`completedAt` decides AC-7) | `students.createProfile` |
| `answers` | one row per (check, question) | `checks.saveAnswers` |

**Page states** (from `students.me`, plus `loading` until it has answered):

| State | Shown | Moves on when |
|---|---|---|
| `loading` | nothing about any student | `me` answers |
| `signedOut` | Google button, test form if the flag is on | sign in completes |
| `needsProfile` | profile step | `createProfile` succeeds |
| `ready`, check open | question 1, saved choice if any | a choice is saved, or sign out |
| `ready`, `completedAt` set | saved answer, finished note, no save control | sign out |

**API surface** (nothing new; every function is existing):

| Call | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `students.me` | query | none | state, `googleName`, `check.answers` | session, optional | none |
| `students.createProfile` | mutation | name, age, class, guardianPresent, consent {version, hash} | studentId | signed in | `invalid_input`, `guardian_required`, `consent_text_changed`, `account_conflict` |
| `checks.saveAnswers` | mutation | answers [{q, optionId, answeredAt}] | saved count | signed in with a profile | `not_signed_in`, `no_profile`, `check_completed`, `invalid_input` |
| `/api/auth/*` (Google, test form, sign out) | HTTP | per Better Auth | session cookie | none | Better Auth errors |
| `/api/auth/convex/token` | HTTP | session cookie | Convex token | session | 401 when signed out |

The one backend code change is `createAuth` in `packages/backend/convex/auth.ts`: the trusted origins list (AC-10), with the new variable declared in `convex.config.ts`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Load `/thread` | signed in or not, profile or not | `students.me` state; the server reads the session, the page sends nothing |
| Google sign in | callback address | `http://localhost:8080/api/auth/callback/google`, from the exact list in spec 0001 |
| Any sign in call | cookie origin and base address | forwarded host header set by the Vite proxy for `localhost:8080`, accepted only when in `BETTER_AUTH_TRUSTED_ORIGINS`, else `BETTER_AUTH_URL` |
| Any Convex call | the signed in token | `/api/auth/convex/token` through the Better Auth Convex client plugin |
| Show the test form | visible or not | build flag `VITE_TEST_SIGNIN`; the server decides with `TEST_SIGNIN_ENABLED` |
| Profile step | name default | `googleName` from `students.me`, editable |
| Profile step | age, guardian tick | typed by the student |
| Profile step | class choices | six fixed labels in the page (`Class 8` to `Class 12`, `College`) matching `classValidator` in `schema.ts`; the server is the judge |
| Profile step | consent lines shown | `CONSENT_LINES` from `@dhi/backend/consentText`, at `CONSENT_VERSION` |
| `createProfile` | consent version and hash | `CONSENT_VERSION` and `consentHash(CONSENT_TEXTS[CONSENT_VERSION])` from the same module |
| Question block | question 1 text, option ids and texts | `DhiQuestions.question(1)` from `@dhi/engine/questions`, written order, no shuffle |
| `saveAnswers` | `q` | the constant `1` |
| `saveAnswers` | `optionId` | the option tapped; the server checks it belongs to question 1 |
| `saveAnswers` | `answeredAt` | device `Date.now()`; the server cuts it down to its own now |
| Read back | the saved choice | `students.me` `check.answers.q1` |
| Finished note | check finished or not | `students.me` `check.completedAt` |
| Sign out | page cleared or not | Better Auth's sign out response; cleared only on success |
| Loading and signed out views | whether the token is ready | `useConvexAuth()` from the Convex client; `students.me` is skipped until it says authenticated |
| Dev proxy and preview proxy | forwarded host and proto | the one `authProxy()` object in `scripts/auth-proxy.mjs`: headers `x-better-auth-forwarded-host: localhost:8080` and `x-better-auth-forwarded-proto: http` (and the plain `x-forwarded-host` and `x-forwarded-proto`), `changeOrigin` on, cookie `Domain` stripped, redirects passed through. The dev server reads it as `server.proxy`, the preview plugin reads the same object |
| Preview proxy | whether `/api/auth` reaches the backend on the local Worker | `authProxyPreviewPlugin` in `vite.config.ts`, which forwards `/api/auth` and `/api/auth/...` (any method, query kept) to `CONVEX_SITE_URL` and nothing else |
| Preview proxy | forwarded host and proto, `Origin`, `Host` | forwarded headers replace the client's, from `authProxy()`; `Origin` unchanged; `Host` is the target's |
| Preview proxy | what the page sees when the backend is down or `CONVEX_SITE_URL` is unset | 502 with an empty body and no logging of the request; unset means no proxy and one warning |
| Retry message | connection down or save pending | the Convex client's connection state, or a save pending for more than 10 seconds |
| Test run | test student email | `thread-<epoch>-<random>@example.test`, new per run, made by the script |
| Test run | test password, class, ages | a constant in the script; `Class 10`; 25 for the adult and 15 for the under 18 student |
| Test run (finished check) | a finished check for AC-7 | the script signs in, gets a token from `/api/auth/convex/token`, and with a Node Convex client saves all 18 answers (`q<n>o1`) with `checks.saveAnswers` and calls `checks.complete` |

**Key invariants**:
- A person never has two accounts because they used the house. The profile step finds the account the funnel would have made (`createProfile` returns the existing student).
- No function takes a student id, email or auth user id from the page. (basis: spec 0003)
- No secret reaches the browser or git. The trusted origins list and the test sign in switch live in Convex variables.
- A student under 18 cannot get a profile without the guardian tick. The page shows the tick and the server enforces it.
- The thread writes only to the development deployment. The production deployment is not touched until spec 0001 phase 5.
- Nothing the page shows or logs carries a name, email or answer in an error or console line.
- With `BETTER_AUTH_TRUSTED_ORIGINS` unset or empty, `createAuth` behaves exactly as it does today (base address `BETTER_AUTH_URL`). The funnel's own `localhost:4321` sign in, which shares the development deployment, keeps working.

**Security model**: sessions are cookies on one origin (`localhost:8080` here). Authorization stays inside the Convex functions through `requireStudent`; the page is only a client. Anyone can send a forwarded host header straight to the `.convex.site` address, so the allow list is the control, and a host that is not on it is refused. The test form is reachable only where both the build flag and the server variable are on, and never in production. Compliance scope: personal data of minors (India's DPDP Act), so the consent step is not optional and no personal data goes in a log. The guardian tick is a self declaration, not verified parental consent, so this thread does not claim to prove DPDP consent; verified consent stays with the funnel's rules and house row 4. (basis: spec 0001 consequences, funnel consent rules)

**Configuration required**:
- House `.env.local` (gitignored): `PUBLIC_CONVEX_URL` (the development deployment's cloud address), `CONVEX_SITE_URL` (its `.convex.site` address, for the dev proxy), `VITE_TEST_SIGNIN` (`true` locally only; it defaults to off and is never set in a clean build). The Vite `envPrefix` includes `PUBLIC_` so the page can read the first.
- Convex development deployment: `BETTER_AUTH_TRUSTED_ORIGINS` = `https://dhirise.com,https://staging.dhirise.com,http://localhost:4321,http://localhost:8080`; `TEST_SIGNIN_ENABLED=true` (already used by the funnel's tests). Production gets `BETTER_AUTH_TRUSTED_ORIGINS=https://dhirise.com` later, at phase 5, not now.
- Google OAuth client: add the redirect address `http://localhost:8080/api/auth/callback/google`. This is a manual step for you (the owner), listed in the Build plan.

**Critical test scenarios** (each maps to a criterion):
- Happy path: test form sign in, profile step, save `q1o2`, reload, `q1o2` still selected, sign out. Verifies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-8**.
- Real Google sign in by a person on `localhost:8080`, same result. Verifies **AC-2**.
- Change the choice, then save the same one twice: one row. Verifies **AC-6**.
- Under 18 without the guardian tick is refused with a plain message; with the tick it passes. Verifies **AC-3**, **AC-9**.
- A student whose check is finished (made by the script through the Node Convex client) sees the answer and no save control. Verifies **AC-7**.
- In a `convex-test`, saving a changed choice and then the same choice twice leaves one `answers` row for question 1. Verifies **AC-6**.
- A forwarded host not in the list is refused with a 403; no header uses `BETTER_AUTH_URL`; an unset list behaves as today; the funnel's `localhost:4321` sign in still works. Verifies **AC-10**.
- A stale session cookie (token route 401) shows the signed out view, and the signed out view never calls `students.me`. Verifies **AC-1**, **AC-9**.
- Connection dropped mid save: the choice stays and a retry message shows. Verifies **AC-9**.
- Full run on the dev server, short sign in, save and reload run on the Worker build. Verifies **AC-12**, **AC-16**.
- The funnel suite and `build:all` pass after the strip. Verifies **AC-11**, **AC-14**.

## Build plan

Tracer Bullet: a thin end to end thread first on the existing dev server (steps 1 to 8), then the old code comes out and the Worker build goes in (steps 9 to 11), then the proof (steps 12 to 14). Typecheck stays green after every step.

1. [x] Backend: trusted origins in `createAuth` (`packages/backend/convex/auth.ts`), the new variable in `convex.config.ts`, unit tests with `convex-test` for every case in AC-10 (in the list, not in the list, no header, unset, empty, mixed case) and for AC-6 (one `answers` row). Push to the development deployment and set the four origins, then sign in once on the funnel at `localhost:4321` to confirm it still works. Check Better Auth's current way to take the base address from an allowed host with a fallback (doc check), satisfies **AC-10**, **AC-6**
2. [x] Owner step: add `http://localhost:8080/api/auth/callback/google` to the Google OAuth client, satisfies **AC-2**
3. [x] House setup: add `convex`, `@convex-dev/better-auth`, `@dhi/backend` and `@dhi/engine` as workspace or catalog dependencies at the pinned versions; add `envPrefix` for `PUBLIC_`; add the `/api/auth` dev proxy to `CONVEX_SITE_URL` as one shared proxy object (`scripts/auth-proxy.mjs`, also read by the preview plugin in step 10) with `changeOrigin`, `x-better-auth-forwarded-host: localhost:8080`, `x-forwarded-proto: http`, cookie `Domain` stripped and redirects passed through, satisfies **AC-2**
4. [x] House auth client and provider: rewrite `src/lib/auth/client.ts` as a Better Auth client with the Convex plugin (Google sign in, email sign in, sign out); mount `ConvexBetterAuthProvider` in `src/routes/thread.tsx` only and drive `loading` and `signedOut` from `useConvexAuth()`. In the same step delete `use-current-user.ts`, `gates.tsx`, `middleware.ts`, `verify.server.ts`, `provider.tsx` and its mount in `__root.tsx`, which have no user in any room, satisfies **AC-2**, **AC-11**
5. [x] `/thread` signed out view: Google button, test form behind `VITE_TEST_SIGNIN` (default off), neutral loading view, `students.me` skipped until authenticated, nothing fetched about a student while signed out, satisfies **AC-1**
6. [x] `/thread` profile step with the shared consent text, the six class labels and the guardian tick, calling `createProfile`, satisfies **AC-3**, **AC-9**
7. [x] `/thread` question 1: show it from `@dhi/engine/questions`, save with `saveAnswers`, read back from `students.me`, replace and repeat save, finished state, plain error messages (including `account_conflict`, the stale session case and the retry message after 10 seconds pending or a dropped connection), satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-9**
8. [x] `/thread` sign out, cleared only after the server confirms, satisfies **AC-8**
9. [x] Strip the old code (only now that the thread works): delete the files in the removal list below, drop `pg`, `@types/pg`, `@electric-sql/pglite`, `kysely` and `jose` (not `nitro` yet, step 10 does that so `server/` and the build stay green), remove the `build` step `node scripts/migrate.mjs`, the `db:migrate` and `check:auth` scripts, and the removed files' tests from `test:house`. In `vite.config.ts` remove the `authPopupPlugin`, the PGLite bootstrap plugin and the `migration-plan` import, and keep `nitro()` for now. Edit `scripts/browser-smoke.mjs` to drop its import of the removed auth check. Remove `VITE_AUTH_ENABLED` outright. Check that the kept `isolation.server.ts` and `src/lib/app-data/` import none of the removed files. Search that nothing still imports them, satisfies **AC-11**
10. [x] Worker build, in one step so the build stays green: replace `nitro()` with `@cloudflare/vite-plugin` in `vite.config.ts`, drop the `nitro` dependency, remove `server/` (the Nitro middleware and its type file), add `wrangler.jsonc` and the `wrangler` dependency at the pinned version, and let the router plugin regenerate `routeTree.gen.ts`. No deploy script. Add `authProxyPreviewPlugin` to `vite.config.ts` (`enforce: "pre"`, registered directly in `configurePreviewServer`), passing the shared `authProxy()` object to `http-proxy-3` (add it as an exactly pinned dev dependency) for `/api/auth` and `/api/auth/...` in the preview server only. Remove the dead `preview: { proxy }` from `vite.config.ts` and correct the `preview.proxy` comment at the top of `scripts/auth-proxy.mjs`. A pure function decides which requests the plugin takes and which headers it sets; it is unit tested for `/api/auth`, `/api/auth/x?y=1`, `/api/authx` (left alone), a forged forwarded host header (replaced), and an unset address (nothing registered). Serve the build locally with `vite preview --port 8080 --host localhost` and check `/api/auth` reaches the development deployment. If it still does not, stop and return to `/architect`, satisfies **AC-12**
11. [x] TypeScript: try `^7.0.2` in the house and run `typecheck:house` and `lint:house`; if either fails, set both parts to the highest version both accept. Write the result and reason into the TypeScript row of spec 0005, satisfies **AC-13**
12. [x] Repeatable proof: a script `scripts/thread-check.mjs` using the `playwright` package the house already has. It runs AC-1 to AC-8 on the test form, once as an adult and once as an under 18 student with the guardian tick, against the dev server, then the short sign in, save and reload check against the Worker build. For AC-7 it signs in, fetches a token from `/api/auth/convex/token`, and uses a Node Convex client to save all 18 answers and call `checks.complete`. Test inputs are in the Value sourcing table, satisfies **AC-16**, **AC-7**
13. [x] Secrets check: search the built client for the Google and Better Auth secret names and values, and confirm a clean `build:all` with no `.env.local` builds with `VITE_TEST_SIGNIN` off, satisfies **AC-15**
14. [x] Live guard: confirm no change under `apps/joining/`, no production deploy command was run, then run the root `pnpm typecheck`, `lint`, `test` and `build:all`, satisfies **AC-14**

**Removal list for step 9** (spec 0005 names most of these; this adds the ones it missed):
- In `src/lib/auth/`: `server.ts`, `popup.server.ts`, `providers.ts`, `preview.ts`, `email-password.ts`, `pglite-dialect.ts`, `gate-identity.server.ts`, `gate-session.server.ts`, `gate-session-marker.ts`, `sign-in-gate.ts`, and the tests `gate-identity.test.ts` and `sign-in-gate.test.ts`. Kept: the new `client.ts` and `isolation.server.ts`.
- `src/lib/db.ts`, `migrations/auth/0001_auth.sql`, `scripts/migrate.mjs`, `scripts/migration-plan.mjs` and its test.
- Added by this spec: `scripts/check-auth-invariant.mjs` and its test, `scripts/sign-out-plan.mjs` and its test (they exist only for the preview bearer token flow), and the `VITE_AUTH_ENABLED` handling in `scripts/with-app-env.mjs` and its test if nothing else reads it.
- In `vite.config.ts`: the `authPopupPlugin`, the PGLite bootstrap plugin and the `migration-plan` import (step 9), then the `nitro()` plugin (step 10).
- `server/middleware/grok-pwa.ts` and `server/virtual-grok-og-identity.d.ts` (step 10, with Nitro). The dev half of the sandbox install page (`scripts/grok-pwa-plugin.mjs`) stays.

## Consequences

**Positive**:
- The house signs in through the one shared session before any house table exists, so house row 2 starts on a proven base.
- The funnel's profile and consent rules are proven in the house, not copied.
- The house loses its database and broker packages, and the Worker build is known to work before real rooms depend on it.
- A repeatable script guards the thread while the house keeps changing.

**Negative / tradeoffs**:
- The thread writes real funnel rows (a student, a consent, a check, an answer) into the development deployment. That is test data only, and it never reaches production, but it is not cleaned up automatically.
- The page imports the whole question file, which also holds scoring hints. The funnel already serves the same file publicly, so nothing new is exposed, but the house bundle carries it.
- The class list is a second copy of six labels. A change in `schema.ts` shows up as `invalid_input` until the page is updated.
- The Worker build is proven on one local port only. The deployed forwarder, routing and cookie behaviour on `dhirise.com` are proven later by rows 13 and 17.
- The local Worker run needs one more dev dependency (`http-proxy-3`) and a small plugin that exists only to forward `/api/auth` in `vite preview`. It is not in the build output, but it is code to keep in step with `scripts/auth-proxy.mjs`.
- Removing `src/lib/auth/` also removes the template's `SignedIn` and `SignedOut` helpers. House row 2 builds its own on the shared session.

**Neutral**:
- `migrations/` is empty after step 9, and the house `AGENTS.md` rules about the database and `migrations/` become stale. Run `/sync` after the build.
- `src/lib/multiplayer/p2p.ts` still calls `/api/rtc`, which has no server in this repo. It is not part of this row. The `/app-api/rtc` move in spec 0001 waits for a room that needs it.

## Follow-up

- [ ] Spec 0005's drop list is missing the files added in the removal list above. Step 11 and step 9 should update that list when the build lands, or run `/architect` to edit it now.
- [ ] Add the thread's local run (dev server and Worker build) to the house `AGENTS.md` after the build, through `/sync`.
- [ ] Decide later whether the `/thread` route stays as a health page or is removed once house row 2 has real sign in screens.
- [ ] The test student rows on the development deployment: decide whether the existing purge code (`purge.ts`) should be run on a schedule there.
- [x] Confirm the Better Auth Convex integration for TanStack Start still names `/api/auth/convex/token` in the version pinned by spec 0005, before step 4.

## References

**Project sources** (verifiable, in this repo):
- Spec 0001 (the four origin contract, phase 3) · spec 0003 (shared sign in, trusted origins, house session token) · spec 0005 (what the house drops, TypeScript decision) · spec 0006 (workspace)
- `packages/backend/convex/students.ts`, `checks.ts`, `helpers.ts`, `consentText.ts`, `auth.ts` (the functions this thread reuses)
- `packages/engine/questions.js` and `AGENTS.md` (the question bank and its rules)
- The installed `convex`, `convex-auth`, `better-auth-best-practices` and `wrangler` skills

**Practices & standards**:
- Tracer bullet (a thin working thread through every layer, then thicken)
- Strangler pattern (the old house auth stays until the new one is proven)
- Consent and data minimisation for minors (India's DPDP Act, section 9)
