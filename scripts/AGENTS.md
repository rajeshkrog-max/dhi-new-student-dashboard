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
| `platform-check.mjs` | `pnpm platform:check`: real browser proof of the funnel link (a made up adult takes the DhiRise check, is invited, links it on Your data, the download holds their answers, unlink, and the card is gone after a withdrawal) and that an institute admin is never offered the move to another institute (house spec 0002). The DHI admin's move itself is backend only (`memberMove.test.ts`), because a test inbox can never be a DHI admin. Same guards as `enter:check`; needs the funnel built |
| `desk-check.mjs` | `pnpm desk:check`: real browser proof of the DHI desk (house spec 0016): two fresh made up students, one question of each kind with its exact price, a free clarify, the care text, the diagram shown only as a picture, and a classmate's stored answer for 0 coins. Calls the real model on the development deployment (about seven calls a run). Same guards as `mood:check` |
| `parent-check.mjs` | `pnpm parent:check`: real browser proof of the weekly parent page (house spec 0022): the private link from Your data, the page with no sign in holding only days logged and the three lamps, the look in Who has looked, gone during a class pause and back on resume, gone after the link is removed; and the bedtime and mood connection on Progress (house spec 0023, seed scenario `connected`). Pauses and resumes Class 10 A of the demo institute, and always resumes it. Same guards as `mood:check` |
| `burst-check.mjs` | `pnpm burst:check`: many calls at once (30 wrong sign ins, 40 desk questions from one made up student, 30 study hour heartbeats and chat messages) must end in a normal answer or a plain refusal (`rate_limited`, `busy`, 401, 429), never a server error. Makes one real model call on development. Needs an open hour (`hourProof:openNow`). Same guards as `mood:check`, and refuses a `.env.local` that does not point at proper-camel-616 |
| `hourcall-check.mjs` | `pnpm hourcall:check`: real browser proof of the study hour call (house spec 0027): opens a fresh hour (`hourProof:openNow`), two fresh made up students sit Live and join with a fake camera and microphone, see each other, the recording is on, named buttons turn the camera and microphone on, the demo teacher joins from Hour calls as a moderator, all leave, then the recording plays under the content policy (up to 8 minutes; `--no-recording` skips it) and is shared with one student and taken back. Uses the Stream app's free minutes. Same guards as `mood:check` |
| `staff-check.mjs` | `pnpm staff:check`: real browser proof of the staff houses (house spec 0026): the demo institute admin and teacher land on Home and its Open buttons lead to their pages, neither sees Overview or Counselors, and the teacher opens a student's Papers (states only, never an answer). The DHI admin's screens are backend tested only (a test inbox is never a DHI admin). Same guards as `mood:check` |
| `school-check.mjs` | `pnpm school:check`: real browser proof of the school report (house spec 0025): the demo teacher and the demo institute admin open it for Class 10 A; only the admin sees the room counts; nothing from the rooms or the Brain shows; a range over 13 weeks is refused. Same guards as `mood:check` |
| `counsel-check.mjs` | `pnpm counsel:check`: real browser proof of counseling (house spec 0024): a fresh made up counselor (`counselProof:makeCounselor`) opens the next half hour, a fresh made up student books it with a note, cancels and books again, the counselor sees only the first name, class, school and note, the session is moved to a minute ago (`counselProof:startNow`), both join the real Stream call in two browsers with a fake camera and microphone, the recording shows as on, both leave, the note after, a share with the demo teacher and its removal, then up to 8 minutes for the recording to load under the content policy (`--no-recording` skips that). Uses the Stream app's free minutes. Same guards as `mood:check`; needs the funnel built |
| `rehearsal-check.mjs`, `words-export.mjs` | `pnpm rehearsal:check`: the first look after a deploy (`docs/HOUSE-DEPLOY.md` section 5) on development in a fresh Rehearsal School made by `rehearsalProof:setup`: staff join, a minor waits for the parent's consent, both students open every room, the class pause, download and erase. `node scripts/words-export.mjs` writes every drafted word into `docs/launch/words/` (English and Hinglish, by room) from the words files |
| `mood-check.mjs`, `habit-check.mjs` | `pnpm mood:check` and `pnpm habit:check`: real browser proofs of the mood room (house spec 0006) and the habits room (house spec 0007), run against `pnpm dev` and the development backend. The habits proof also leaves the room open across 04:00. Same guards as `enter:check`; each needs the demo institute (`demo:seed`) and `VITE_TEST_SIGNIN=true` in `.env.local` |
| `fresh-student.mjs`, `test-student.mjs`, `local-dev-guard.mjs` | The shared helpers of the browser proofs. `freshStudent` invites, joins and consents a new made up student, so a room's per day limits never carry over between runs. `test-student.mjs` signs in the fixed demo people, and `signInCounselor` makes the demo counselor with a development helper. `local-dev-guard.mjs` refuses production and any address that is not this machine |
| `look-check.mjs`, `look-check.baseline.json` | `pnpm look:check` (house spec 0003, AC-13): fails on a new hand typed colour or free corner size in `src/`; the baseline may only go down. A line with `look-ok: <reason>` is exempt |
| `sleep-check.mjs` | `pnpm sleep:check`: real browser proof of the sleep room (house spec 0008): the default night, save and reload, a second device, a changed bed time, the read back, a tap kept during a save, the 04:00 notice and staff seeing nothing. Same guards as `mood:check`; needs the demo institute and `VITE_TEST_SIGNIN=true` |
| `exams-blog-check.mjs`, `meals-check.mjs`, `modules-check.mjs`, `hour-check.mjs`, `brain-check.mjs` | `pnpm exams:check`, `meals:check`, `modules:check`, `hour:check` and `brain:check`: real browser proofs of papers, exams and the blog (a teacher builds, sends and marks, a student sits and accepts, the institute admin sees the mark), the food table and meals, the films, the study hour and the feeling card, and the Progress page. Same guards and setup as `mood:check`. `hour:check` and `brain:check` call the development helpers `hourProof:addFinishedStay` and `brainProof:seed` (they refuse production) |
| `check-catalog.mjs` | Fails when a library in the `catalog:` list of `pnpm-workspace.yaml` is pinned directly in a part. Its short exception list is a constant in the script. Runs from `pnpm lint` |
| `responsive-sweep.mjs`, `responsive-verdict.mjs` | Phone, tablet and desktop width sweep of the house rooms (`pnpm responsive:sweep`) and its pure verdict. Its `prepare` step opens a paper (`papersProof:openDemoPaper`), an hour (`hourProof:openNow`) and a heavy fortnight for the demo student (`brainProof:seed`) so the sitting, the seats and the Progress page have something to show |
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
