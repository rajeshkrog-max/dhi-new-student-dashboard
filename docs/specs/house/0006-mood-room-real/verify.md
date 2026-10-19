# Verify: mood room, real, with the Vedic lens · spec 0006 · updated 2026-10-19
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
Setup for the browser steps: `pnpm dev` (port 8080), the development backend with the demo institute seeded, `VITE_TEST_SIGNIN=true` in `.env.local`. Use only made up people.

## UI / manual
- [x] Sign in as the demo student, open Mood Tracker, pick Tired, write a line and press "Colour today" → "Your colour for today is saved" shows, with a tamas line → AC-1, AC-8 (`pnpm mood:check`)
- [x] Reload the page → the same colour and the same line are read back → AC-1 (`pnpm mood:check`)
- [x] Open the room in a second browser signed in as the same student → the same entry shows (another device) → AC-1 (`pnpm mood:check`)
- [x] Pick Happy then Stressed and save each → the guna line follows (sattva, then rajas) and the day still reads as one entry → AC-2, AC-8 (`pnpm mood:check`)
- [x] Change only the line and save → the colour stays, and the second browser follows without a reload → AC-2 (`pnpm mood:check`)
- [x] The new guna lines and tips carry a "Draft words" mark, and no clinical word shows → AC-8 (`pnpm mood:check`)
- [x] Try to type more than 500 characters → the box stops at 500 → AC-4 (`pnpm mood:check`)
- [x] Text typed while a save is in flight is kept → AC-11 (`pnpm mood:check`)
- [x] Open the room at 360, 768, 1024 and 1280 px, including a chosen day and the help button → no sideways scroll, tap targets at least 44 px → AC-11 (`pnpm responsive:sweep --room mood,mood-day,mood-help`)
- [x] Leave the room open across 04:00 India time (the browser clock is jumped 26 hours) → the screen says the day moved on, keeps a half written line, and a save still works → AC-11 (`pnpm mood:check`)
- [x] Sign in as a teacher and an institute admin → the staff area shows no mood and the dashboard sends them to it → AC-6 (`pnpm mood:check`). A DHI admin cannot sign in on the test sign in; the backend suite proves no function reads a mood for anyone but its student.

## Commands
- [x] `pnpm --filter @dhi/backend test -- moods` → 21 tests pass: save and read back, the event holds only the code, one entry a day, edits replace the event, a note only change writes no event, the 10 change cap, the day edges, the note rules, the gate and every other role refused, the source scan, the limit, export and erase in pages → AC-1 to AC-10
- [x] `node --experimental-strip-types --test src/lib/dhi/mood-words.test.ts` → 6 pass: the screen's moods equal the server's codes, every mood has a guna, no clinical word and no label, two lines for each mood → AC-8
- [x] `npx convex run moodProof:race '{"attempts":8}'` on the development deployment → `rows` is 1 and `currentEvents` is 1 for 8 first saves at once → AC-2 (the live race the in memory tool cannot show)
- [x] `pnpm test` → the whole suite passes (848 backend, 321 funnel) → AC-12
- [x] `git diff main --stat -- apps` → empty, no funnel file changed → AC-12
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build:all` → pass → AC-12
- [x] `pnpm mood:check` → 10 of 10 steps pass, twice in a row (a fresh made up student each run) → AC-1, AC-2, AC-4, AC-6, AC-8, AC-11

## Acceptance-criteria coverage
- AC-1 … UI 1 to 3; commands 1, 7 · AC-2 … UI 4, 5; commands 1, 3 · AC-3 … command 1 · AC-4 … UI 7; command 1 · AC-5 … command 1 · AC-6 … command 1; UI 11 · AC-7 … command 1 · AC-8 … UI 1, 4, 6; command 2 · AC-9 … command 1 · AC-10 … command 1 · AC-11 … UI 8 to 10 · AC-12 … commands 4 to 6
