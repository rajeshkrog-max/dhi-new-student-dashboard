# Verify: consent, privacy and access record · spec 0005 · updated 2026-10-19
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Needs `pnpm dev`, the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`), `VITE_TEST_SIGNIN=true` in `.env.local`, and `ERASURE_HASH_SECRET` set on the development deployment.
- [x] Invite a student marked under 18, sign in as them and press Join → only "Before you enter" shows, with no name, no class and no rooms; "I agree" is locked and a draft mark shows → AC-1, AC-18, AC-20
- [x] Scroll the notice to the end → "I agree" unlocks; press it → "Waiting for your school" shows → AC-1, AC-2, AC-20
- [x] As the institute admin open Parent consent → the draft words show, the student is listed as "Not recorded"; press Record consent → the student's house opens by itself → AC-3, AC-20
- [ ] As a DHI admin open the staff area → there is no Parent consent screen → AC-3
- [x] As the student open Your data, turn parent sharing on → it shows "On: a summary", and it started Off → AC-9
- [x] Press Download my data → one file `my-dhi-data.json` with `schema`, `profile`, `consent`, `sharing`, `events`, `rooms` and nothing about anyone else → AC-12
- [x] Press Withdraw my consent → "The house is paused for you" on the next screen; open Your data and bring it back → the house opens → AC-5
- [x] As the admin press "Parent withdrew" → the student is paused and Your data says only the school can bring it back; press "Parent restored" → the house opens → AC-5
- [x] As the student press Erase my data, then "Yes, erase everything" → signed out; as the admin invite the same email → the neutral refusal, with no reason given → AC-13
- [x] `pnpm responsive:sweep` → `data`, `consent`, `consent-data` and `staff-parent` are ok at 360, 768, 1024 and 1280 → AC-20

## Commands
- [x] `pnpm --filter @dhi/backend test -- houseConsent` → all consent tests pass (56) → AC-1 to AC-19, AC-22 to AC-24
- [x] `pnpm consent:check` → 11 of 11 steps pass in a real browser → AC-1 to AC-6, AC-9, AC-12, AC-13, AC-20
- [x] `pnpm enter:check` → 27 of 27 steps pass (a joined student now meets the consent gate first) → AC-1, AC-22
- [x] `pnpm test` → the whole suite passes including the funnel's 321 tests unchanged → AC-21
- [x] `git diff main -- apps/` → no funnel file changed → AC-21
- [x] Vary the age flag: a DHI admin marks an adult under 18, then back → locks until a parent record exists, then opens; a parent record survives the flip; a school withdrawal binds only while under 18 → AC-4
- [x] Vary the tenant: another institute's admin, a teacher, a DHI admin and a counselor each try `consent.recordParent` → refused, and another institute's student reads as `not_found` → AC-3
- [x] Vary the viewer: teacher, institute admin, DHI admin and counselor against every kind of data → exactly the table in the spec; a DHI admin and a counselor never get room content → AC-7, AC-8, AC-24
- [x] Class totals: 9 students with data → nothing; 10 → a count; a withdrawn student drops the count; the current month and a month over a year old are refused → AC-23
- [x] Retention: a view record older than 3 years, a member removed 12 months, a reinstated member and a member of a suspended institute through `retention.sweep` → only the first two are removed; a second run changes nothing → AC-15
- [ ] `pnpm --filter @dhi/backend exec convex run dataRights:adminErase '{"email":"...","school":"...","class":"..."}'` with one fact wrong, and for an adult → `no_match` each time → AC-13
- [x] Source scans in `houseConsent.test.ts` → only `staffRead.ts` writes the view record, only the sweep deletes one, consent records are never changed, logs hold counts only → AC-6, AC-10, AC-19

## Acceptance-criteria coverage
- AC-1 … UI 1, 2; commands 1 · AC-2 … UI 2; command 1 · AC-3 … UI 3, 4; commands 1, 7 · AC-4 … command 6 · AC-5 … UI 7, 8 · AC-6 … command 1, 12 · AC-7 … command 8 · AC-8 … command 8 · AC-9 … UI 5 · AC-10 … commands 1, 12 · AC-11 … command 1 · AC-12 … UI 6 · AC-13 … UI 9; command 11 · AC-14 … command 1 · AC-15 … command 10 · AC-16 … command 1 · AC-17 … command 1 · AC-18 … UI 1 · AC-19 … command 12 · AC-20 … UI 1 to 3, 10 · AC-21 … commands 4, 5 · AC-22 … commands 3 · AC-23 … command 9 · AC-24 … command 8
