# Hardening for production

Written 2026-10-27 in Phase 2 of the production run (`docs/PRODUCTION-RUN-PROMPT.md`). It names every gap found, what was fixed, and what is left. Nothing here was run against production: production is `abundant-caiman-975`, development `proper-camel-616`. No secret value is printed anywhere in this file.

## 1. Settings, development and production side by side

The Convex variables are declared in `packages/backend/convex/convex.config.ts` and set per deployment with `npx convex env set` (production only with the owner's yes). The production column says what production must have; it was not read, because reading it is a `--prod` command. Check it with the owner before the backend deploy (`npx convex env list --prod`, run where nobody sees the screen).

| Variable | What it does | Development (read 2026-10-27) | Production must be | Who sets it |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | the sign in secret (read by Better Auth) | set (secret) | set, its own value | owner |
| `BETTER_AUTH_URL` | the sign in address | `http://localhost:4321` | the production funnel address | owner |
| `BETTER_AUTH_TRUSTED_ORIGINS` | allowed origins | dhirise.com, staging and local | dhirise.com only (and staging if used) | owner |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign in | set | set | owner |
| `TEST_SIGNIN_ENABLED` | the email test sign in and every `*Proof` helper | `true` | **unset** (or `false`) | owner |
| `ERASURE_HASH_SECRET` | the 30 day erase block | set (secret) | **set**, a different value; erase refuses without it | owner |
| `OPENAI_API_KEY` | the desk's model | set (secret, the key pasted in chat) | **a new key**, on production only | owner, after rotating the pasted one |
| `DESK_LIVE` | the desk's off switch (no deploy needed) | `true` | `true` only when the owner opens the desk; unset keeps it closed | owner |
| `DESK_MODEL` | the model name | unset (default `gpt-4o-mini`) | unset or the owner's choice | owner |
| `DESK_DAILY_CAP` | questions to the model a day, whole deployment | unset (default 300) | unset (300) or the owner's number; `0` stops the model | owner |
| `SHARE_LINK_SECRET`, `PUBLIC_SHARE_ENABLED` | the funnel's private report link | set, `true` | already set on production (2026-10-11), untouched | owner |
| `PROFILE_PICTURE_ENABLED`, `PICTURE_CONSENT_REQUIRED`, `LEADERBOARD_PICTURES_ENABLED` | the funnel's picture switches | `true`, unset, unset | as they are; untouched | owner |
| `CHALLENGE_LIVE`, `CHALLENGE_ENDS_AT` | the funnel's challenge | `true`, unset | as they are; untouched | owner |
| `GOOGLE_SERVICE_ACCOUNT_KEY`, `SHEET_ID` | the funnel's Sheet copy | set, unset | as they are | owner |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `REPORT_RENDER_SECRET`, `REPORT_RENDER_BASE_URL` | the funnel's report copy | set, set, set, unset | as they are | owner |
| `TEAM_EMAILS` | the funnel's team link | set | as it is | owner |

The Brain's switches are code constants, not variables: `PATTERN_SOURCES_CONFIRMED` and `FOOD_PATTERN_ON` in `brainRules.ts` (both false), and the word approvals (`*_WORDS_APPROVED`, all false). Flipping one is a commit (see `OWNER-GATES.md`).

**The Worker** (`dhirise-house`, `wrangler.jsonc`): it has no variables of its own. `scripts/deploy-house.mjs` builds with `PUBLIC_CONVEX_URL` set to the production address and `VITE_TEST_SIGNIN=false`, and refuses to deploy a build that holds `proper-camel-616` or an enabled test sign in. The routes take only the house's own paths on dhirise.com; every top level folder in `public/` (`__grok`, `desk`, `habits`, `landing`, `meals`, `mood`, `study`, plus `favicon.svg` and `og.jpg`) has its route.

**The local file**: the root `.env.local` had been pointed at a local anonymous Convex backend by a stray `npx convex dev` at the repo root on 2026-10-22 (it also made the stray root folder `convex/`, not committed). It was pointed back at `proper-camel-616` on 2026-10-26. The stray folder can be deleted with the owner's yes.

**The key scan** (2026-10-26): the working tree, the build output (`dist/`, `apps/joining/dist/`) and the whole git history hold nothing shaped like an OpenAI key. The pasted key lives in the chat only; it must still be rotated.

## 2. Desk spend and abuse

| Guard | Where | Proven by |
|---|---|---|
| 60 coins a month for each student, topped up once a month, never below zero | `desk.ts` (`walletFor`, `begin`) | `desk.test.ts`, `desk:check` |
| 30 questions an hour, 20 free clarifies an hour, for each student | `limits.ts` (`deskAsk`, `deskClarify`) | `desk.test.ts` |
| 20 questions to the model a day for each student (owner, 2026-10-26) | `limits.ts` (`deskStudentDay`) | `desk.test.ts` |
| 300 questions to the model a day for the whole deployment, changed with `DESK_DAILY_CAP` | `desk.begin`, `deskDaily` | `desk.test.ts` |
| A stored answer and the care text never reach the model and never count | `desk.begin` | `desk.test.ts`, `desk:check` |
| The exam lock | `examLock.hasOpenSitting` in `desk.begin` | `desk.test.ts` |
| A model call times out after 60 seconds; the coins go back | `deskAsk.ts` | `desk.test.ts` |
| A question that never finished gets its coins back within 2 minutes | `desk.sweepPending` (every minute) | `desk.test.ts` |
| Many questions from one student at once answer `busy`, never a server error | `deskAsk.ask` | `burst:check` (40 at once: 18 ok, 22 busy) |
| When the model is down the student sees "The desk could not answer just now. No coin was taken." | `desk-words.ts` (`model_failed`) | `desk.test.ts` |
| The off switch with no deploy | `DESK_LIVE` | `desk.test.ts` |

Gap: an answer stored in the cache can echo the words of a question for its 90 days (the key is a hash, but the answer is text); the personal check catches only emails and phone numbers. Gap: a talk deleted while its question is pending still makes its one model call (the answer is thrown away).

## 3. Authorisation

- Room by room, every role, the gate, a withdrawal, a removal, a paused institute and another institute: `houseAccess`, `healthAccess`, `studyAccess`, `brainWall`, `desk`, `papers`, `blog`, `studyHour`, `funnelLink`, `parentSharing` tests.
- The net under them, `authSweep.test.ts`: every public house function found by scanning the files is called signed out and gives nothing; the three open on purpose (`parentReport.open`, `members.me`, `foods.groups`) give exactly what they should.
- No staff function reads the Brain: `brainWall.test.ts` (functions, the access rule and a scan of every reader).
- `/security-review` of the whole branch (2026-10-27): no High or Medium finding. Named for the owner: the study hour chat review shows a teacher their own classes' messages and a DHI admin the reported ones of every institute, without a `staffRead` record (moderation, as the spec says).
- Gap: sign in has no rate limit of its own on development (30 wrong passwords at once all answered 401). Production has Google sign in only, so there is no password to guess; Better Auth's own limiter is left as it is because the funnel shares it.

## 4. Privacy

- The export holds every table of a person's own rows (`privacySweep.test.ts`, `exportHolds.test.ts`): 21 of 22. **Gap:** `teacherClasses` (a teacher's own class links) has no download, because there is no staff download yet.
- Erase leaves only what the data map says is kept (`houseConsent.test.ts`, each room's erase test).
- No house log line holds personal data: two log lines, counts only (`privacySweep.test.ts`).
- No event holds free text: the registry has no free text kind (`eventLog.test.ts`, AC-8).
- The parent page holds only `weekOf` (`parentSharing.test.ts`, `parent:check`).

## 5. Schema and cron jobs

Against `main` (2026-10-18, the last merge): 44 new tables and new indexes; one line changed in an old table only to add an index (`by_storageId`); nothing removed or renamed. **Check at deploy:** that `main` is what production runs (the Convex deploy shows the schema changes before it applies them; stop if it lists a removal).

New cron jobs, which start with the backend deploy: drop idle study hour seats (every minute), close due exam sittings (every minute), update the Brain's daily values (every minute), close yesterday for the Brain (22:45 UTC), check the Brain's stored days (23:15 UTC), rebuild stale Brain days (every 10 minutes), return coins of unanswered desk questions (every minute), end idle desk sittings (every minute), house retention sweep (22:00 UTC; now also deletes study hour chat after 30 days and desk answers after 90). `METRIC_VERSION` is 7, so stored Brain days are rebuilt from the events in the background (production has none yet).

## 6. Load and races (development, 2026-10-26)

| Check | Result |
|---|---|
| `moodProof:race`, `sleepProof:race` (8 at once) | one row, one current event, none refused |
| `habitProof:race` (8 at once) | one check |
| `eventProof:race` | 12 same key: one stored; 12 keys: 12 stored |
| `burst:check` (new) | 30 wrong sign ins: all 401; 40 desk questions at once: no server error (found 21 server errors first, fixed: no shared counter written on a cache hit, and a conflict answers `busy`); 30 heartbeats and 30 chat messages: ok and `rate_limited`, no server error |

## 7. Frontend

- `pnpm responsive:sweep` (2026-10-27): every room and screen clean at 360, 768, 1024 and 1280. Fixed on the way: the live study hour seat card, the home score card values, and the Your data link card (now last) all moved while loading.
- Accessibility (axe, WCAG 2.0 and 2.1 A and AA, 2026-10-27): the Enter screen, every room, the consent screen, the parent page and the staff screens at 1280 and 360. Fixed: the mood tile labels (contrast as low as 1.3 to 1; each mood now takes the ink that reaches 4.5, and Sad is two steps darker), and the mood and habits rings (hidden from screen readers, out of the tab order; the lists beside them carry the numbers). Now: 0 failures. Keyboard: Tab goes through the menu, the search, the bell and the room; every focused item shows its mark; Enter opens a room; the phone menu opens with Enter, closes with Escape and gives focus back. Not done: a real screen reader pass (VoiceOver or NVDA) and 200% zoom, which need a person.
- The build refuses a development address or an enabled test sign in (`deploy-house.mjs`).
- Security headers (found by the production pentest of 2026-10-27: dhirise.com and the house sent none): every house page now gets a content policy (only the house, its own Convex deployment, data and blob pictures; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`), `X-Frame-Options: DENY`, HSTS, `nosniff`, a referrer policy and a permissions policy (`src/start.ts`, `src/lib/security-headers.ts`); static files get theirs from `public/_headers`. The script policy keeps `'unsafe-inline'` because the framework writes two inline scripts. On the dev server only it also allows the Grok preview tooling, eval and the reload socket. Every browser proof and the full sweep pass under it, and no screen trips it. Gap: the funnel's own pages on dhirise.com still send almost none of their `_headers` (the funnel's part).

## 8. Supply chain and CI

- `pnpm install --frozen-lockfile`, the catalog check (in `pnpm lint`) and CI's steps pass locally on Node 24.
- `pnpm audit`: `zod` (Better Auth's request checks, a memory exhaustion advisory) updated from 4.6.5 to 4.6.7, the only package that changed in the lockfile. Left: 3 high and 4 moderate in build and dev tools only (`wrangler`'s local runner `miniflare` with `sharp` and `undici`, Astro's font fetch with `undici`); none run in the deployed house or backend. Update them when the tools ship fixes.
- Gap: many committed house files are not Prettier formatted (`pnpm format:check` would fail); not in CI, not a risk.

## 9. Recovery

1. **Before the backend deploy:** take a snapshot of production: `npx convex export --prod --path <folder outside the repo>` (owner's yes; it holds personal data, keep it private and delete it after the pilot settles).
2. **Backend rollback:** deploy the previous commit again (`git checkout <previous> && pnpm --filter @dhi/backend deploy:convex`, owner's yes). The schema is additive, so the older code runs on the newer tables; a restore of the snapshot is the last resort (`npx convex import --prod --replace`), only if data was damaged.
3. **Worker rollback:** `wrangler rollback` to the previous version (owner's yes). The older Worker still runs against the newer backend.
4. **Switches with no deploy:** `DESK_LIVE` (the desk off), `DESK_DAILY_CAP=0` (the model off, stored answers still served), a class's `Pause logins` in Staff, Classes (the pilot's stop), and an institute's `Pause` in Staff, Institutes (every member of it). A room cannot be switched off on its own without a deploy; pausing the pilot class is the way.

## 10. Watching after launch

| What | Where | How often | Who |
|---|---|---|---|
| Errors and failed functions | Convex dashboard, production, Logs (filter "Uncaught" and `[ERROR]`) | daily in the pilot's first two weeks | the owner (or the person they name) |
| The cron jobs run | Convex dashboard, Schedules, the cron list above | at launch, then weekly | the owner |
| `brain.reconcile: n of m stored days differ` | Logs | daily | the owner |
| `retention.sweep:` counts | Logs | weekly | the owner |
| Desk questions to the model today against the cap | Staff, DHI desk (DHI admin): "Today x of y new questions have gone to the model" | daily | DHI admin |
| Desk spend | the OpenAI account's usage page for the new key | weekly | the owner |
| The pilot class | the class's students and their teacher, the staff review of spec 0021 | per the checklist | the owner, the teacher, DHI staff |
