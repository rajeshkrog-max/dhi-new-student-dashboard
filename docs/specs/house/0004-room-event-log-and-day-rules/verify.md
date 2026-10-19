# Verify: room event log and day rules · spec 0004 · updated 2026-10-19
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
There is no screen for the log. The log is reached only by server code, so every step below is a command.

## Commands
- [x] `pnpm --filter @dhi/backend test -- dayRules` → the day rule tests pass: 03:59:59.999 is the earlier day, 04:00:00.000 the next, 01:00 counts for the day before, month ends, year ends and 29 February are right → AC-2, AC-3
- [x] `pnpm --filter @dhi/backend test -- eventLog` → all event log tests pass (60) → AC-1 to AC-12, AC-14, AC-16
- [x] `node --experimental-strip-types --test src/lib/dhi/day-rules.test.ts` → the house screens import the same day rule file the server uses → AC-13
- [x] `grep -n "import" packages/backend/convex/dayRules.ts` → no import lines, and no `Date.now`, `ctx.` or `process.` in the file → AC-13
- [x] `pnpm --filter @dhi/backend exec convex run eventProof:seed` then `... eventProof:race '{"memberId":"<id>","attempts":10}'` on the development deployment → `sameKey.stored` is 1, `sameKey.freshWrites` is 1, `manyKeys.stored` equals `manyKeys.attempts` → AC-4 (the live race, which the in memory tool cannot show). Keep `attempts` at 10 or fewer: 14 and 20 different keys for one student and one day at once can run out of Convex retries, which the spec lists as a tradeoff (checked 2026-10-19)
- [x] `pnpm test` → the whole repo suite passes, including the funnel's 321 tests unchanged → AC-15
- [x] `git diff main -- apps/` → no funnel file changed by this build → AC-15
- [x] Vary the input: record an event for a student who joined at 02:00 and one for the day before the join day → the first is allowed, the second is `before_joined` → AC-6
- [x] Vary the input: a correction from another student, another day, another room or another type → `replaces_mismatch` → AC-7
- [x] Vary the tenant: a teacher of another class, a counselor and an institute admin each try to record about a student → `forbidden` → AC-9

## Acceptance-criteria coverage
- AC-1 … covered by step 2 · AC-2 … step 1 · AC-3 … steps 1, 3 · AC-4 … steps 2, 5 · AC-5 … step 2 · AC-6 … steps 2, 8 · AC-7 … steps 2, 9 · AC-8 … step 2 · AC-9 … steps 2, 10 · AC-10 … step 2 · AC-11 … step 2 · AC-12 … step 2 · AC-13 … steps 3, 4 · AC-14 … step 2 · AC-15 … steps 6, 7 · AC-16 … step 2
