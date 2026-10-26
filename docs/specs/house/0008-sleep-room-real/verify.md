# Verify: sleep room, real · spec 0008 · updated 2026-10-20
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Needs `pnpm dev`, the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`), `VITE_TEST_SIGNIN=true` in `.env.local`. Use only made up students. Nothing here touches production.
- [ ] Sign in as a fresh student past the consent gate and open Sleep → the menu has "Sleep" after Habits; the card shows 23:00 to 06:30 with a length of 7 h 30 min, and the strip shows seven "not logged" dots → AC-8, AC-11 (the proof checks the times and the save; the seven dots are for you to see)
- [x] Press Save once → the button then reads "Saved" and is disabled and the night shows as logged; reload and open the room from a second browser context → the same night shows → AC-1, AC-7, AC-11
- [x] Move the bed time by 15 minutes and Save → the strip bar changes; the next visit starts at the new times → AC-2, AC-11
- [ ] Log a few nights over several days (or use the proof) → from the third night the usual bedtime and the average length show; before that the room asks for a few more nights → AC-8
- [ ] Read every word on the screen → no score, no target hours, no "good" or "bad" night, no advice, and a draft mark shows for the new words → AC-8
- [x] Type or tap the steppers while a save is in flight → nothing typed is lost → AC-11
- [x] Leave the room open across 04:00 (the proof fast forwards the clock) → the screen moves to the new night and says so → AC-3, AC-11
- [x] Open Sleep at 360, 768, 1024 and 1280 px → no sideways scroll, taps of at least 44 px on touch, text of at least 12 px → AC-11

## Commands
- [x] `pnpm --filter @dhi/backend test -- sleep` → the sleep tests pass → AC-1 to AC-10
- [x] `pnpm --filter @dhi/backend exec convex run eventProof:seed` then `... sleepProof:race '{"attempts":8}'` on the development deployment → one row and one current event after many first saves at once → AC-2
- [x] `pnpm sleep:check` → the browser proof passes (a fresh student saves, reloads, edits, and sees it in a second context) → AC-1, AC-2, AC-11
- [x] `pnpm responsive:sweep --room sleep` → ok at four widths → AC-11
- [x] `pnpm look:check` → no new hand typed colour or corner size → AC-11
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build:all` → all pass, with the funnel's tests unchanged → AC-12
- [x] `git diff main --stat -- apps/joining` → no funnel file changed → AC-12
- [x] Vary the input: `bedMin` 7 and 1440, `lengthMin` 45, 60, 960 and 975, a night over midnight → the first, second, third and fifth are refused, 60 and 960 save, over midnight saves, and nothing refused is stored → AC-4
- [ ] Vary the viewer: a student at the gate, one who withdrew, a teacher, an institute admin, a DHI admin and a counselor call `sleep.save` and `sleep.recent` → each is refused → AC-5
- [ ] Vary the tenant: a second student's `recent` → only their own nights; a source scan finds no other reader of `sleepNights` → AC-6
- [x] Day rule: a save at 03:59:59.999 and at 04:00:00.000 → different nights, the row's day equals the event's `loggedFor`, and a second save at 03:30 on the same house day changes that night instead of making a new row → AC-3
- [ ] Read the event of a saved night in the Convex dashboard → `bedMin` and `lengthMin` only → AC-1
- [ ] Download my data after a few nights → the file lists each night with bed, wake and length; Erase my data then leaves none → AC-9
- [ ] The 31st save in an hour → `rate_limited`, and it still counts → AC-10

## Acceptance-criteria coverage
- AC-1 … UI 2; commands 2, 3, 12 · AC-2 … UI 3; commands 2, 3 · AC-3 … UI 7; command 11 · AC-4 … command 8 · AC-5 … command 9 · AC-6 … command 10 · AC-7 … UI 2 · AC-8 … UI 1, 4, 5 · AC-9 … command 13 · AC-10 … command 14 · AC-11 … UI 1, 3, 6, 7, 8; commands 3, 4, 5 · AC-12 … commands 6, 7

_2026-10-20: built and checked locally. Ran: the backend suite (888 tests, sleep tests included), the live race proof `sleepProof:race` on the development deployment (8 saves at once, 1 row, 1 current event), `pnpm sleep:check` (11 of 11), the sweep at 360, 768, 1024 and 1280 px (ok after the strip labels moved to 12 px), `pnpm look:check`, the copy test, lint on the new files and an empty funnel diff. Not run by hand yet: the usual bedtime after three nights, the seven dots on a brand new day, the staff matrix for every role, the export and download file, the full lint and build:all, and `/check verify`, `/test` and `/check review`._
