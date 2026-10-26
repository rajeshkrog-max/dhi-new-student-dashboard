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

Phase 0, preflight: checks done, all green. Waiting for the owner's yes to the commit plan below.

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

## Open

- The owner's yes to the commit plan (8 slices, proposed 2026-10-26).
- A stray root folder `convex/_generated/` (empty generated api, made 2026-10-22, likely a `npx convex` run at the root). Left out of every commit; ask before deleting.
