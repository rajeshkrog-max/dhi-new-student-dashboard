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

Phase 1, groups A, B and C closed 2026-10-26 (fixes not yet committed: the owner is asked at the next commit point). Phase 1 closed 2026-10-26: groups A to F verified, tested, reviewed by a fresh model and documented. Next: the owner's yes to commit the Phase 1 fixes, then Phase 2 (hardening). Phase 0 is done and the 8 slices are committed (no push).

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
| 2026-10-26 | 2 | D | Built early: the desk daily cap (`deskDaily`, `DESK_DAILY_CAP` default 300, `desk_day_full`), today's count on the DHI admin's desk screen. `DESK_LIVE=false` is the off switch with no deploy. 4 new tests | pass |

## Open

- On development: one pending, unclaimable DHI admin invite for `demo-dhi@example.test` (made by an early run of platform:check). Harmless; can be revoked.
- Many committed house files and scripts are not Prettier formatted (`pnpm format:check` would fail). Phase 2 item.
- A stray root folder `convex/_generated/` (empty generated api, made 2026-10-22, likely a `npx convex` run at the root). Left out of every commit; ask before deleting.
