# Verify: habits room, real · spec 0007 · updated 2026-10-19
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
Setup for the browser steps: `pnpm dev` (port 8080), the development backend with the demo institute seeded, `VITE_TEST_SIGNIN=true` in `.env.local`. Use only made up people.

## UI / manual
- [x] A fresh student opens Habit Tracker → "No habit yet", with a "Draft words" mark and no clinical word → AC-12 (`pnpm habit:check`)
- [x] Add a habit from the form and tick it → the card changes to "Undo", and after a reload the tick is still there → AC-1, AC-4 (`pnpm habit:check`)
- [x] Open the room in a second browser as the same student → the habit and its tick show (another device) → AC-4 (`pnpm habit:check`)
- [x] Undo the tick, then tick again → both devices follow, and the day reads as unticked then ticked → AC-5 (`pnpm habit:check`)
- [x] Add habits until there are five → New habit closes; remove one → it opens again → AC-1, AC-7 (`pnpm habit:check`)
- [x] Add a habit that starts in three days → it shows "Starts <date>" and its tick is off → AC-3, AC-12 (`pnpm habit:check`)
- [x] Leave the room open across 04:00 India time (the browser clock is jumped 26 hours) → the screen says the day moved on → AC-12 (`pnpm habit:check`)
- [x] Open the room, the New habit form, a habit's slide and the month view at 360, 768, 1024 and 1280 px → no sideways scroll, tap targets at least 44 px → AC-12 (`pnpm responsive:sweep --room habits,habits-new,habits-slide,habits-month`)
- [ ] A sixth habit, a start in the past and a long title are refused by the server when sent by hand → AC-1, AC-2 (the form closes these from the screen; the server refusals are proven by the backend suite, not typed into the browser)

## Commands
- [x] `pnpm --filter @dhi/backend test -- habits` → 24 tests pass: add, tick and read back, the event holds only the kind, the cap of five (open, future, removed, ended), the window and field checks, the day edges, not_open, undo as a void, the 6 flips, the no-ops, not_found for any bad or other student's id, the gate and every other role refused, the privacy scan, the list bound, the write and daily add limits, export and erase in pages → AC-1 to AC-11
- [x] `node --experimental-strip-types --test src/lib/dhi/habits/habits.test.ts` → 4 pass: the screen's catalog ids and colours equal the server's, the new words are clean drafts, refusals have plain words, misses and streaks come from the ticks → AC-4, AC-12
- [x] `npx convex run habitProof:race '{"attempts":8}'` on the development deployment → `checks` is 1 and `currentEvents` is 1 for 8 first ticks at once → AC-5 (the live race the in memory tool cannot show)
- [x] `pnpm test` → the whole suite passes (872 backend, 321 funnel) → AC-13
- [x] `git diff main --stat -- apps` → empty, no funnel file changed → AC-13
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build:all` → pass → AC-13
- [x] `pnpm habit:check` → 7 of 7 steps pass (a fresh made up student each run) → AC-1, AC-4, AC-5, AC-7, AC-12
- [x] `pnpm mood:check` still passes after the shared student helper moved → 10 of 10

## Acceptance-criteria coverage
- AC-1 … UI 2, 5; command 1 · AC-2 … command 1 (UI 9 not typed by hand) · AC-3 … UI 6; command 1 · AC-4 … UI 2, 3; commands 1, 2 · AC-5 … UI 4; commands 1, 3 · AC-6 … command 1 · AC-7 … UI 5; command 1 · AC-8 … command 1 · AC-9 … command 1 · AC-10 … command 1 · AC-11 … command 1 · AC-12 … UI 1, 6 to 8; command 2 · AC-13 … commands 4 to 6
