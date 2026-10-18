# 0008. Interview first entry, and a challenge with no end date

**Status**: Assumed
**Date**: 2026-10-18
**Authorized by**: the owner, during /develop (three choices answered in the session, listed below)

## Owed decision

Which page a student meets after signing in to the house, how the house uses the interview the funnel already runs, and what the Founding Circle Challenge does with no deadline. This replaces the thin thread page of [0007](0007-thin-thread.md) (sign in, save one answer, read it back), which was only a proof.

## Assumption built on

- **The interview stays the funnel's.** It is the funnel's pages under `/dhiinterviews/` (spec 0004 keeps that path with the funnel). The house does not rebuild it. Nothing about the interview's look changed.
- **The account is already shared.** The funnel's student record and answers sit in the same Convex backend the house reads (`students.me`), so nothing is copied or seeded by hand. "Seeding" means the house reads the record the interview made.
- **The front door is `/enter` in the house.** Google and the dev only test form come back there. It reads `students.me` through `entryTarget` (`src/lib/entry.ts`): a finished check goes to `/dashboard`; a new account, or one that has not finished the check, goes to the interview's landing page; a signed out visitor sees the Enter screen. The old `/thread` page, its components, its `src/lib/thread` rules and `pnpm thread:check` are removed.
- **The dashboard is `/dashboard`.** It shows the existing house rooms (still demo data) with the student's own name, initials and class from their account. Leave there signs out for real.
- **After the interview, one more button.** The end of the report shows "Go to your dashboard" only when `funnel-config.js` sets `dashboardUrl` (empty in the repo and for the live funnel, so nobody loops back to the landing page before the house is live on the address). The local dev server sets it to `/dashboard`.
- **One address locally.** The house dev server serves the funnel's built files (`apps/joining/dist`, from `pnpm --filter dhirise build`) and forwards the funnel's other `/api/*` routes, so the interview and the house share `localhost:8080` and one sign in cookie, as they will on `dhirise.com` (`scripts/funnel-local.mjs`, dev only).
- **The challenge deadline is optional.** The server setting `CHALLENGE_ENDS_AT` (an ISO date with an offset) is read on every call. Unset, empty or not a date means the challenge never ends: nobody is refused, no referral is rejected for time, the board never freezes, and the pages show no countdown, no "Ends" rule and no time left chip. The browser repeats the date in `challenge-config.js` only when one is set; the repo ships with none. Set both to the same value to bring an end date back.

The three choices the owner made in the session: the deadline is an optional end date (not deleted); the dashboard shows the student's real name and class (the rest stays demo); the dashboard button is on the final screen and switched by config.

## The house on the root address (decided and built 2026-10-18)

The owner asked for the dashboard on `dhirise.com` and the interview where it is. Built as the house Worker `dhirise-house`, deployed with `pnpm deploy:house` (build with the production Convex address and the test sign in off, refuse a build that holds the development address, then `wrangler deploy`).

- **The funnel stays on its Cloudflare Pages project.** The house takes only the paths it serves, through Worker routes in `wrangler.jsonc`: `/`, `/enter*`, `/dashboard*`, `/home*`, `/assets/*`, `/__grok/*`, `/favicon.svg`, `/og.jpg` and the picture folders of `public/`. Everything else (`/dhiinterviews*`, `/s/*`, `/api/*`, `/_astro/*`, unknown paths) still reaches the funnel. This is narrower than spec 0004's "everything but the funnel's paths" and means the funnel does not have to move to Workers for this. A new top level folder in `public/` must be added to the routes.
- **`/` is the front door.** Signed in with a finished interview goes to `/dashboard`, new or unfinished to the interview, anyone else sees the Enter screen. `/home` (the old demo house) now redirects to `/dashboard`, and the dashboard shows a "sample data for now" note, because its rooms still run on demo data.
- **Referral and campaign links.** Cloudflare refuses a query string in a route pattern (error 10022) and a route for `/` does not match `/?ref=ABC1234`. So a root address with a query string is not the house's: it takes the funnel's own `/` redirect (`public/_redirects`), which keeps the query string and lands on the interview with the code intact. The house also forwards `?ref=` when it does see it (local work), but production relies on the redirect.
- **`www.dhirise.com` is not routed yet** and still takes the funnel's redirect to the interview.
- **Rollback:** `pnpm exec wrangler delete --name dhirise-house` removes the Worker and its routes. The funnel's own redirect from `/` to the interview is still in `public/_redirects`, so `/` then behaves as it did before.
- **Not yet seen:** a real Google sign in on `dhirise.com` ending on the dashboard. Google starts correctly (redirect address `https://dhirise.com/api/auth/callback/google`, back to `/enter`), but the owner has not completed the loop with a real account.
- **No security headers from the house yet.** The funnel's Pages `_headers` (HSTS, `frame-ancestors 'none'`, referrer policy) do not apply to the house Worker. Adding them in the Worker is a follow up.

## Code area

`src/routes/{enter,dashboard,index}.tsx`, `src/components/dhi/{enter-screen,convex-session}.tsx`, `src/lib/{entry,dhi/student}.ts`, `scripts/funnel-local.mjs`, `vite.config.ts`; the funnel's `public/dhiinterviews/js/{api,challenge,challenge-ui,challenge-config,leaderboard,report-student,funnel-config.example}.js`, `js/engine/reportText.js`, `src/lib/session.ts`, `src/pages/dhiinterviews/{challenge,terms}.astro`; the backend's `challengeRules.ts`, `challenge.ts`, `challengeCore.ts`, `challengeBoard.ts`, `challengeAdmin.ts`, `feedback.ts`, `referral.ts`, `students.ts`, `convex.config.ts`.

## Requirements

- An account with no interview data, or an unfinished check, is sent to the interview and nowhere else.
- An account with a finished check reaches the dashboard and sees its own name and class, never the demo name.
- A visitor with no session sees the sign in screen and nothing about any student.
- With `CHALLENGE_ENDS_AT` unset, joining, hiding a name, feedback and referrals work at any date, and `me` and `leaderboard` answer `endsAt: null`.
- With it set, the old rules apply exactly as before (the existing suites run with the old date).

## Still owed

- **The words.** The versioned challenge consent text (`consentText.ts`) still says the contest ends "by 11:59 pm India time on 30 October 2026". It is a saved legal record that changes only as a new version, so it was not edited. The Terms page sentence about dates was changed to "no end date for the moment". Both need the owner's approval (and the lawyer check already owed) before this reaches students.
- **Production.** Nothing here is deployed. Production has never had `CHALLENGE_ENDS_AT` (the date used to be a constant in code), so **the first production backend deploy from this branch removes the 30 October deadline for good**: joins, referrals and feedback are accepted with no end, and the board never freezes. That is what the owner asked for, but it is a rule change on a live contest with under 18 participants, so it must be a deliberate deploy. To keep the date instead, set `CHALLENGE_ENDS_AT=2026-10-30T23:59:00+05:30` on production first. The production backend deploy follows scope row 18.
- **Bringing an end date back takes four edits, and nothing ties them together:** the Convex setting `CHALLENGE_ENDS_AT`, `endsAt` in the funnel's `challenge-config.js` (the page copy, used for the countdown), the date sentence in the Terms page, and a new version of the challenge consent text. A value without an offset (such as `2026-10-30`) is refused and logged, and the challenge then has no end.
- **A pending referral never expires while there is no end date.** A friend who never finishes, or an imported check (which can never count), stays `pending`, and each 5 minute run reads it again. The cost grows slowly with abandoned referrals. Accepted for now; an age limit on a pending referral is the fix if the job ever gets slow.
- **This spec replaces one clause of 0007.** 0007 AC-14 says no file under `apps/joining/` is edited. At the owner's request, spec 0008 edits the listed funnel files (the deadline pages, the report's dashboard button, the Terms sentence). The rest of AC-14 stands: no production command was run, the Convex push went to the development deployment only, and the suites pass.
- **Real Google round trip for the new front door.** It uses the same call as before and Google accepted it, but the full loop through `/enter` was seen only with the test sign in.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect interview first entry` to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.
