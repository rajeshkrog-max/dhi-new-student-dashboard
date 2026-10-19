# Verify: people, roles, invites and institutes · spec 0002 · updated 2026-10-19
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
Setup: `pnpm dev` (port 8080), the development backend with the demo institute seeded (`pnpm --filter @dhi/backend exec convex run demo:seed`), `VITE_TEST_SIGNIN=true` in `.env.local`, and for the owner steps your own Google account. Use only made up people. Nothing here touches production.

## UI / manual
- [ ] Run `npx convex run bootstrap:dhiAdmin '{"email":"<your Google email>","name":"<your name>"}'` in `packages/backend`, sign in at `/enter` with that Google account → you see "You are invited" with role DHI admin and no institute, press Join, land in the staff area with Institutes, Classes, People, Invites and Class list → AC-1
- [ ] As that DHI admin add an institute, press Open, then under Invites invite a first institute admin with a second Google email, who signs in and presses Join → they land in the staff area for that institute only (no Institutes screen) → AC-2
- [ ] Sign in with a Google account that has no invite and no membership, then open `/dashboard` → "You are not in a house yet", nothing created, and the funnel interview still opens for that account → AC-3
- [ ] Sign in with an invited address and look before pressing Join → the institute name and role show, and the People list of the institute does not yet list the person → AC-3
- [ ] Upload a class list with one bad row (for example a wrong email) → nobody is invited and the bad row is named in plain words; fix it and send again → every student is invited → AC-4
- [ ] A student presses Join → they land in the dashboard under the name and class from the list, and their funnel account is unchanged (a funnel student who is invited keeps their saved check) → AC-5
- [ ] Try to claim with an unverified Google email, an expired invite (Extend then wait is not needed: use the test steps below), a cleared invite and a different email → each is refused in plain words → AC-6
- [ ] As an institute admin try to open another institute's classes, people and invites by changing nothing but the institute shown (you cannot, the screens only show your own) → AC-7
- [ ] A teacher signs in → they see only My classes, My students and Invites for their own classes, and no Institutes or admin screens → AC-7, AC-8
- [ ] An institute admin Pauses a student, then the student reloads → "Your access is paused"; Bring back restores the dashboard → AC-9
- [ ] Pause the only DHI admin or the only admin of an active institute → refused with "This is the last admin" → AC-10
- [ ] As a DHI admin change a student's under 18 flag from People → it changes; an institute admin and a teacher have no such button → AC-11
- [ ] Pause an institute from Institutes → its admin, teachers and students all see "Your institute is paused" on their next load; Resume restores them → AC-16
- [ ] Open the staff screens and the Join page at 360, 768, 1024 and 1280 px → no sideways scroll, tap targets at least 44 px on touch, lists show 25 and a Show more button → AC-18
- [ ] Open `/dashboard`, `/staff` and `/join` signed out → each goes to the front door → AC-13

## Commands
- [ ] `pnpm --filter @dhi/backend test` → all pass, including `houseAccess.test.ts` (the role by function matrix), `houseInvites.test.ts`, `houseEntry.test.ts` and `houseCore.test.ts` → AC-4 to AC-12, AC-15 to AC-19
- [ ] `pnpm test` → the funnel suite and the house tests all pass with no funnel file changed → AC-14
- [ ] `pnpm enter:check` → 27 of 27 steps pass, including an invite made on the staff screen and joined by a fresh test account → AC-2, AC-3, AC-5, AC-9, AC-13
- [ ] `pnpm responsive:sweep` → every room, the Join page, "not in a house" and the four staff screens are ok at four widths → AC-18
- [ ] `npx convex run demo:seed` on the development deployment → makes the demo institute and invites; running it again makes none; on a deployment with `TEST_SIGNIN_ENABLED` not `true` it answers `demo_disabled` → AC-13
- [ ] Search `src/` for `gate.tsx`, `session.ts`, `dhi-session-v1` and `useGate` → no match → AC-13
- [ ] `git diff main --stat -- apps/joining` → no funnel file changed → AC-14
- [ ] Read a few `accessLog` rows in the Convex dashboard → ids and a code only, no name, email or note → AC-12

## Value sourcing (one step per row of the spec's table)
- [ ] Who is acting: call any staff function after signing out → refused, and no function takes a member id or email as the caller → AC-7
- [ ] Role, institute, class and entry state: change a teacher's classes (give, then take away) and reload their People screen → it follows at once → AC-7
- [ ] Claim: the email matched is the session's Google email → an invite typed with different capital letters still matches; another address does not → AC-6
- [ ] Claim: name, class and under 18 come from the invite → the dashboard shows the invite's name and class, not the Google name → AC-5, AC-11
- [ ] Create invite: `expiresAt` is 14 days out → Extend moves it 14 days from now → AC-6
- [ ] Batch: the row limit is 300 → a list of 301 rows is refused with "up to 300 rows" → AC-4
- [ ] Every list: 25 a page → People, Invites, Classes and Institutes each show 25 then Show more → AC-18
- [ ] Rate limits: pressing Join with no invite 11 times in an hour → the 11th says "too many tries for now"; the 51st refused invite for one institute in a day does the same → AC-17, AC-19

## Acceptance-criteria coverage
- AC-1 bootstrap and DHI admin · AC-2 institute and first admin · AC-3 not in a house, pending invite · AC-4 class list · AC-5 Join makes a member only · AC-6 claim rules · AC-7 and AC-8 matrix and walls · AC-9 pause and bring back · AC-10 last admin · AC-11 under 18 · AC-12 access log · AC-13 demo gate gone, seed refuses outside test sign in · AC-14 funnel untouched · AC-15 purge · AC-16 paused institute and archived class · AC-17 and AC-19 limits · AC-18 screens and 25 a page
- Not exercisable with a test sign in (a verified Google account is needed): the DHI admin screens (Institutes) and a DHI admin or counselor invite. The backend tests cover them, and the owner steps at the top cover them by hand.
