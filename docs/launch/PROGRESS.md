# Launch progress

The run log for the production run in `docs/PRODUCTION-RUN-PROMPT.md`. Read this first after any compaction. Updated after every step.

## Decisions (owner, 2026-10-26)

1. Commits: one commit per row group (about 8) on `house/people-roles-invites`, after the owner's yes to the commit plan. No push.
2. Desk spend: 60 coins a month per student stays. Add a daily cap for the whole deployment of 300 questions a day, and a switch that turns the desk off without a deploy.
3. Rehearsal: on the development deployment `proper-camel-616` only.
4. Launch flags: every owner gate flag stays false until the owner approves it. The pilot starts with one class of made up students.

## Standing rules

No git push, no production deploy, no `--prod` command and no production env change without the owner's fresh yes in that same message. `npx convex dev --once` to development is allowed. Commit only after the yes to the commit plan. Keep CRLF in edited files. Never label a student by ability or rank. The Brain is the student's alone except the weekly parent page. Only made up students. The OpenAI key never appears in code, git, docs or logs. One decision at a time with AskUserQuestion. Plain words. Report faithfully.

## Where we are

Phase 1, groups A, B and C closed 2026-10-26 (fixes not yet committed: the owner is asked at the next commit point). Phases 1 and 2 done (2026-10-27). Phase 1 committed (3 commits, no push). Phase 2 written up in `docs/launch/HARDENING.md`, its fixes not yet committed. Phase 3 done (2026-10-27): `OWNER-GATES.md`, `words/english.md` and `words/hinglish.md` (from `scripts/words-export.mjs`), `hinglish-reader.md`, `legal-check.md`. Phase 5 done (2026-10-27): the ready report is given to the owner. Verdict: go for deploying the code with the desk off and only made up people; no go for real students until the owner gates close. Phase 6 step 1 done 2026-10-27: the Phase 2 to 4 work is committed (19e7602, a734d48, e8f464e), not pushed. Step 2 done 2026-10-27: pushed to origin (e6bb909..e8f464e, 22 commits). Step 4 done 2026-10-27: the house Worker is live on dhirise.com (version 0fb0bfb4, from e8f464e). Next: the owner claims the DHI admin invite with subs.dhi@gmail.com; the security headers finding waits for the owner's yes. Phase 0 is done and the 8 slices are committed (no push).

## Log

| When | Phase | Group | Step | Result |
|---|---|---|---|---|
| 2026-10-26 | 0 | all | Read AGENTS.md, HOUSE-DEPLOY.md, BACKEND.md, PRODUCTION-RUN-PROMPT.md, scope index | done |
| 2026-10-26 | 0 | all | `pnpm install --frozen-lockfile` | pass |
| 2026-10-26 | 0 | all | `pnpm typecheck` (house and every part) | pass |
| 2026-10-26 | 0 | all | `pnpm lint` | pass, 0 errors and 5 warnings (the baseline, all react-refresh/only-export-components) |
| 2026-10-26 | 0 | all | `pnpm look:check` | pass, 27 hits, all within the baseline |
| 2026-10-26 | 0 | all | `pnpm test` | pass: house node:test 199 pass, 0 fail, 4 skipped (the og skill file is gitignored); backend 1288 of 1288; funnel 321 of 321; scripts 81 of 81 |
| 2026-10-26 | 0 | all | `pnpm build:all` | pass |
| 2026-10-26 | 0 | all | backend `npx vitest run` | pass, 60 files, 1288 tests |
| 2026-10-26 | 0 | all | backend `npx tsc --noEmit` | pass |
| 2026-10-26 | 0 | all | `git status` | 226 entries: 66 modified, 16 deleted (old demo files), the rest new |
| 2026-10-26 | 0 | all | Owner's yes to the 8 slices; key pattern scan of the staged files clean; 8 commits made on `house/people-roles-invites` | done, not pushed |
| 2026-10-26 | 1 | A | `npx convex dev --once` to proper-camel-616, `demo:seed` | pass |
| 2026-10-26 | 1 | A | Root `.env.local` pointed at a local anonymous backend (127.0.0.1:3210/3211, made 2026-10-22 15:09 by a root `npx convex dev`). Pointed back at proper-camel-616 (public addresses only, git ignored) | fixed |
| 2026-10-26 | 1 | A | `pnpm enter:check` | pass, 27 of 27 |
| 2026-10-26 | 1 | A | `pnpm consent:check` | first 8 of 12. Bug: Your data showed the funnel card to a withdrawn student, `funnelLink.status` threw behind the consent gate and the page crashed. Fixed in `your-data.tsx` (card only while consent is ok). Then 12 of 12 |
| 2026-10-26 | 1 | A | New `pnpm platform:check` (funnel link, move staff) | found bug: `joinExport` in `src/lib/dhi/your-data.ts` dropped the funnel part, so a linked student's download never held their answers. Fixed with a unit test. Then 6 of 6, one skip: the DHI admin's move cannot run in a browser because a test inbox can never be a DHI admin (by design); `memberMove.test.ts` covers it |
| 2026-10-26 | 1 | A | /test: new backend test, a withdrawn or paused student cannot read or make the funnel link, an earlier link stays in the download | pass (funnelLink 8 of 8) |
| 2026-10-26 | 1 | A | `pnpm responsive:sweep` | no overflow, target or text failure. Layout shift over 0.05, also alone: hour-live (0.06 to 0.15), settle-dashboard, home, sleep (0.057 to 0.073). Open for groups C and F. The first full run was slowed by parallel test runs and a push, rerun per room |
| 2026-10-26 | 1 | A | Fresh review (subagent): 7 findings. Fixed 1 to 5 (retention cursor, four row kinds missing from the download, class list probe cap, missing under 18 flag in the parent erase, reinstate into an archived class). 6 decided by the owner: the parent page reads as gone during a class pause. 7 not fixed (unlink while withdrawn; low harm) | see `docs/reviews/2026-10-26-group-a-platform.md` |
| 2026-10-26 | 1 | A | Backend suite 1301 of 1301, both typechecks, house tests; enter 27/27, consent 12/12, platform 6/6 after the fixes | pass |
| 2026-10-26 | 1 | A | /document and /sync: review file, scope boxes (verify rows 2 and 4), AGENTS lines | done |
| 2026-10-26 | 1 | B | mood 10/10, habit 9/9, sleep 11/11, meals 6/6 (after its stale desk step was updated) | pass |
| 2026-10-26 | 1 | B | Fresh review: 8 findings, all settled (publish leaves the waiting list, meals remove limit, note word count event, meals day turns at 04:00, yesterday's plates removable, 500 a day read, newest own dishes, export marks removed plates). Search index for the catalog left for the first import | see `docs/reviews/2026-10-26-group-b-health.md` |
| 2026-10-26 | 1 | B | Backend 1303 of 1303, both typechecks, meals and mood proofs rerun | pass |
| 2026-10-26 | 1 | C | modules 5/5, hour 7/7; exams 8 of 13 on the first run (under load), then 13/13 twice | pass |
| 2026-10-26 | 1 | C | /test: `studyAccess.test.ts` (role and lock matrix, scan of 43 functions) | pass |
| 2026-10-26 | 1 | C | Fresh review: 9 findings. Fixed 1, 3, 4, 6 (stronger), 7, 8 and the blog line breaks; 2 decided by the owner: a server exam lock (`examLock.ts`), built and tested; 9 left on purpose; blog tags follow spec 0014 | see `docs/reviews/2026-10-26-group-c-study.md` |
| 2026-10-26 | 1 | C | The live study hour layout shift fixed (the seat card holds its place). The server lock exposed proofs that leave the demo student mid sitting: `papersProof:resetDemoSitting`, called by the sweep and `exams:check` | pass |
| 2026-10-26 | 1 | C | Backend 63 files all pass, both typechecks; exams 13/13, hour 7/7, modules 5/5, sweep of the sitting scenes clean | pass |
| 2026-10-26 | 1 | D | New `desk:check` 11/11 twice (real model on the dev key, about seven calls a run) | pass |
| 2026-10-26 | 1 | D | Fresh review: 5 findings and one small. Owner chose 20 a day per student (built). Fixed: hashed cache key and 90 day deletion, indexed exam lock, diagram length, care text before the lock. Small one left (a deleted pending talk still makes its call) | see `docs/reviews/2026-10-26-group-d-desk.md` |
| 2026-10-26 | 1 | D | Backend 1312 of 1312, both typechecks | pass |
| 2026-10-26 | 1 | E | brain 8/8; new `parent:check` 6/6 (and a `connected` seed); `brainWall.test.ts` | pass |
| 2026-10-26 | 1 | E | Fresh review: 5 findings. Fixed 1 (bedtime and mood never fired on real days), 2 (an old parent link came back), 3, 5; 4 left on purpose | see `docs/reviews/2026-10-26-group-e-brain.md` |
| 2026-10-26 | 1 | F | Home layout shift fixed (fixed width values); home, shell, sleep, hour, modules clean | pass |
| 2026-10-26 | 1 | F | Fresh review: 6 findings, all about the new exam lock. The owner narrowed it to the rooms that could help (desk, blog, study hour, films); Your data and Leave never frozen; a seat can be left; error card resets; no study hour zero on a paper day (metric version 7). 5 and 6 named, not changed | see `docs/reviews/2026-10-26-group-f-home-staff.md` |
| 2026-10-26 | 1 | all | Backend 1317 of 1317 (65 files), both typechecks; exams 13/13, hour 7/7, parent 6/6, brain 8/8; sweep of changed screens clean | pass |
| 2026-10-26 | 2 | all | Key scan: working tree, build output (`dist`, `apps/joining/dist`) and the whole git history hold no OpenAI key pattern (the build matched only `mask-image-` class names, clean with a word boundary) | pass |
| 2026-10-27 | 2 | all | Settings matrix (dev read, secrets as set or unset only; prod not read), Worker routes match `public/`, schema additive against `main`, 9 new crons | done, see HARDENING.md |
| 2026-10-27 | 2 | all | Races on dev: mood, sleep, habits, events all pass. New `burst:check`: desk had 21 server errors of 40 at once; fixed (no cache hit counter, conflict answers `busy`), then clean | pass |
| 2026-10-27 | 2 | all | New `authSweep.test.ts` and `privacySweep.test.ts`; gap named: no staff download (`teacherClasses`) | pass |
| 2026-10-27 | 2 | all | `pnpm audit`: zod 4.6.5 to 4.6.7 (only lockfile change); 7 left in dev tools only | done |
| 2026-10-27 | 2 | all | Accessibility (axe on every main screen at 1280 and 360, keyboard): fixed mood tile contrast and the chart rings; now 0 failures | pass |
| 2026-10-27 | 2 | all | Full responsive sweep: one shift left (Your data at 1024), fixed (the link card last); clean | pass |
| 2026-10-27 | 2 | all | /security-review of the branch: no High or Medium finding | pass |
| 2026-10-27 | 3 | all | Owner packet written. Found: the notice does not mention the DHI desk or its outside model provider (in `legal-check.md`, for the owner) | done |
| 2026-10-27 | 4 | all | Owner chose: no wipe of development, a fresh Rehearsal School. `bootstrap:dhiAdmin` ran on dev (an unclaimed invite, as production will make) | done |
| 2026-10-27 | 4 | all | New `rehearsal:check` (first look, real screens): 9 of 9 | pass |
| 2026-10-27 | 4 | all | `pnpm deploy:house --dry-run`: clean build with the production address, 17 routes, nothing deployed | pass |
| 2026-10-27 | 4 | all | Four dev helpers had no test sign in check (read only internal queries): guarded; `proofGuard.test.ts` scans every helper | fixed |
| 2026-10-27 | 4 | all | `docs/HOUSE-DEPLOY.md` rewritten to match: the desk live, 44 tables, 9 crons, the variables, the snapshot, the rollback | done |
| 2026-10-27 | 6 | all | Owner's yes to commit: 3 commits (17, 5 and 11 files), key scan of the staged files clean, tree clean except the stray root `convex/` | done, not pushed |
| 2026-10-27 | 6 | all | Owner's yes to push: `git push origin house/people-roles-invites`, local and remote both e8f464e. CI did not run: it runs on pull requests and on pushes to main only | done |
| 2026-10-27 | 6 | all | Owner's yes to deploy: snapshot exported (41 KB, outside the repo, also in the dashboard); prod settings read as set or unset only; owner's yes set a fresh `ERASURE_HASH_SECRET` (64 chars, never shown); dry run showed no deletions; `deploy:convex` deployed; `bootstrap:dhiAdmin` made the invite for subs.dhi@gmail.com | done |
| 2026-10-27 | 6 | all | Smoke: /health 200, sessions 200, signed out me = signedOut, email password refused, TEST_SIGNIN unset, crons running (brainState rows at 18:42) | pass |
| 2026-10-27 | 6 | all | Production pentest from outside, signed out: 130 public functions (5 harmless answers), 46 made up parent codes all gone, every HTTP route refuses plainly, foreign origin and stealing callback refused | pass |
| 2026-10-27 | 6 | all | Owner signed wrangler in as subs.dhi@gmail.com (owns the dhirise Pages project); owner's yes: `pnpm deploy:house`, version 0fb0bfb4, 17 routes | done |
| 2026-10-27 | 6 | all | Smoke: house paths 200, referral and interview hand off to the funnel, 404 on unknown paths, live build holds only the production address, Enter screen shows Google and no test form, no browser errors | pass |
| 2026-10-27 | 6 | all | Finding: dhirise.com and the house send no HSTS, nosniff, frame-ancestors or CSP (clickjacking possible) | open, needs the owner's yes |
| 2026-10-27 | 6 | all | Owner's yes to build the security headers: `src/start.ts` middleware, `public/_headers`, a dev only allowance for the Grok tooling. All 15 browser proofs pass under them (after the funnel was rebuilt for development: the backend deploy had built it for production, and the proofs refused it); a probe of every main screen finds no content policy block; the production dry run holds the headers. On the way: Your data drew in pieces (shift 0.57 to 0.69) and now draws once loaded; Leave on the consent view of Your data moved to the header | pass, not committed |
| 2026-10-27 | 6 | all | Owner's yes: commit 017fbb4 and push; `pnpm deploy:house`, version baa323e8 (rollback: 0fb0bfb4) | done |
| 2026-10-27 | 6 | all | Smoke: /enter, /dashboard, /parent 200 with CSP, X-Frame-Options DENY, HSTS, nosniff; assets nosniff; referral and interview hand off; Google button reaches accounts.google.com; no page errors. The policy blocks Cloudflare Web Analytics' injected beacon (owner's choice to allow) and zod's harmless `Function("")` probe (it falls back) | pass |
| 2026-10-27 | 7 | staff | Staff "Your data" download (`dataRights.exportStaffMine`, `staffExport.test.ts`, the data tab, a platform-check step) | pass, not committed |
| 2026-10-27 | 7 | counsel | Counseling on Stream Video (house spec 0024, owner's answers 2026-10-27): backend (3 tables, `counsel*.ts`), the call type `dhi_counsel` on the shared Stream app, the student's room, the counselor's Sessions, the content policy for Stream. Backend 1331 of 1331 | pass, not committed |
| 2026-10-27 | 7 | counsel | Full checks: typecheck, lint (0 errors, the 5 baseline warnings), look:check (27, baseline), tests (house 199 + 4 skipped, backend 1331, funnel 321, scripts 87) | pass |
| 2026-10-27 | 7 | counsel | `counselProof.ts` (dev only: `makeCounselor`, since a test inbox can never claim a counselor invite; `startNow`; `seedDemo`) and `pnpm counsel:check`: 14 of 14, two browsers with fake media on the real Stream app. The recording came from `mumbai.stream-io-cdn.com`, inside the policy's `*.stream-io-cdn.com`: no policy change | pass |
| 2026-10-27 | 7 | counsel | Sweep of counsel, staff-counsel (new) and data at 4 widths: clean. axe: the student room and Sessions clean; the lobby and the live call failed (Stream's icon buttons have no name, the tile name inherited the house ink on a dark tile). Fixed with the house's own named buttons, no tile menu and Stream's light text token; then all six views clean at 1280 and 360, keyboard reaches and picks a time | pass |
| 2026-10-27 | 7 | counsel | A session never marked done stayed "Booked" forever: now reads "Ended" once its call has closed (`shownStatus`). New `counsel-words.test.ts` (5 of 5). Docs: spec 0024, BACKEND.md (recordings on Stream by the owner's choice), legal-check (the counseling line and three tables), OWNER-GATES (`COUNSEL_WORDS_APPROVED`, counseling opens), the AGENTS lines, the words export (325 lines) | done |
| 2026-10-27 | 7 | counsel | Owner: counseling stays open during an exam sitting; the stray root `convex/` deleted. Owner's yes: 3 commits (8f0a53d skills, f5b19d0 code, f7286b3 docs), key scan of the staged files clean, all stored as LF | done |
| 2026-10-27 | 7 | counsel | Owner's yes to push: origin and local both f7286b3 | done |
| 2026-10-27 | 7 | counsel | Owner's yes to the backend deploy: snapshot `prod-2026-10-27-before-counsel.zip` (62 KB, outside the repo, also in the dashboard); prod settings read as set or unset only (Stream key and secret set, test sign in unset, `DESK_LIVE` unset); dry run: 8 indexes added, none deleted; `deploy:convex` done; the funnel rebuilt for development after | done |
| 2026-10-27 | 7 | counsel | Smoke: /health 200, signed out `me` = signedOut, `counsel.freeSlots` and `mySlots` refuse `not_signed_in`, the call action and the dev helper refuse plainly | pass |
| 2026-10-27 | 7 | counsel | Owner's yes to the Worker: dry run clean (production address only), `pnpm deploy:house`, version af48204e (rollback: baa323e8). Smoke: /enter, /dashboard, /staff, /parent 200 with Stream in the policy and `camera=(self)`; referral 302 to the funnel; unknown path 404; Google shown, no test form; only the known Cloudflare beacon block | pass |
| 2026-10-27 | 7 | counsel | Found after the deploy: on a finished session the counselor's share email box shrank to 8 px at 360 px (the sweep's demo had no finished session). Fixed (`basis-60`); `seedDemo` now always adds a finished session, and the sweep catches the old layout (t4) and passes the new one at 4 widths | fixed |
| 2026-10-27 | 7 | counsel | Owner's yes: commit 224f80e and push. Owner's yes: `pnpm deploy:house`, version d84590b0 (rollback: af48204e); dry run clean; house paths 200, referral 302, Google and no test form, no page errors besides the known beacon. The backend was not redeployed (only the development helper changed, which refuses on production) | done |
| 2026-10-27 | 8 | school | Owner's answers: the school report holds the papers plus the existing room counts (no Brain), a support list with paper reasons only, the institute admin and the class's teachers, CR1 only | done |
| 2026-10-27 | 8 | school | Built (house spec 0025): `schoolRules.ts` (pure), `schoolReport.ts` (`forClass`, `roomCounts`), the index `paperSends.by_classId_and_dueAt`, the access code `school.report`, the School report tab, `school-words.ts`. Tests: rules 11, report 8, words 4. Backend 1350 of 1350, typecheck pass after a test type fix, lint 0 errors, look:check in baseline | pass, not committed |
| 2026-10-27 | 8 | school | `pnpm school:check` 4 of 4; sweep of staff-report at 4 widths clean; axe at 360 found the heat map scroll box out of keyboard reach, fixed (a focusable named region), then 1280 and 360 clean | pass |
| 2026-10-26 | 2 | D | Built early: the desk daily cap (`deskDaily`, `DESK_DAILY_CAP` default 300, `desk_day_full`), today's count on the DHI admin's desk screen. `DESK_LIVE=false` is the off switch with no deploy. 4 new tests | pass |

## Open

- On development: one pending, unclaimable DHI admin invite for `demo-dhi@example.test` (made by an early run of platform:check). Harmless; can be revoked.
- Many committed house files and scripts are not Prettier formatted (`pnpm format:check` would fail). Phase 2 item.
- Closed 2026-10-27: the stray root folder `convex/_generated/` was deleted on the owner's yes. Counseling stays open during an exam sitting (owner, 2026-10-27).
