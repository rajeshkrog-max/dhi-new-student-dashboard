# Review, import/funnel-history, 2026-10-18

**Reviewed by**: Claude Opus 5.5 (fresh reviewer; author on a different session)
**Scope**: about 126 files (92 tracked changes plus 34 untracked new files, generated output, lock file and PDFs left out), working tree vs HEAD on import/funnel-history, base main
**Verdict**: Changes requested

## Summary

The change does three things: it strips the house's old Postgres, Nitro and broker sign in and moves the house onto the shared Convex sign in as a Cloudflare Worker build (spec 0007); it adds the front door `/enter` and the real `/dashboard` (spec 0008); and it makes the Founding Circle Challenge end date an optional server setting, `CHALLENGE_ENDS_AT`, with "unset means never ends". The house side is clean, small and well tested, and the dev tooling is careful about path traversal and forged headers. The headline problems are in the deadline change: the end date now lives in two places with no check tying them together, and the default turns a live deadline off on the next backend deploy, which the spec describes the other way round.

## Major

### 🟠 The end date now has two sources and the guard test that tied them was removed, `apps/joining/public/dhiinterviews/js/api.js:174`
**Problem**: The server reads `CHALLENGE_ENDS_AT` (an env setting) and the pages read `window.DHI_CHALLENGE.endsAt` (a static file in the repo). The old test in `apps/joining/tests/challenge-rules.test.js` asserted the two were equal; it was replaced by a test that only asserts the config is empty. The server already sends its value to the pages (`challenge.me.endsAt`, `challenge.leaderboard.endsAt`, kept by `api.js:149` in `lastBoard.endsAt`), but no page reads it. Bringing a deadline back now needs three separate edits that nothing checks: the Convex env value, `challenge-config.js`, and the Terms page sentence (`terms.astro:22` promises "we will say so on this page").
**Why it matters**: This is the live funnel. If the env is set and the file is not (or the other way), a student sees no countdown while the server answers "ended", or sees "Ended" and a closed join card while the server still accepts referrals. The prior design caught that drift in CI; this one cannot.
**Suggested fix**: Make the server the one source for the pages: have `api.endsAtMs()` prefer the `endsAt` from the last `me` or `leaderboard` answer (it is `null` when unset), keeping `challenge-config.js` only as an offline fallback, or drop `endsAt` from the config entirely. If the config copy stays, add a test or a deploy check that fails when the config and the deployment disagree, and make the Terms date sentence come from the same value.

### 🟠 "Unset means never ends" switches off the live deadline on the next backend deploy, and spec 0008 says the opposite, `packages/backend/convex/challengeRules.ts:8`
**Problem**: Production (abundant-caiman-975) has no `CHALLENGE_ENDS_AT` today, because the date was a constant in code. With this change, the first production `deploy:convex` of anything on main (including an unrelated hotfix) makes production read "unset" and the 30 October deadline disappears: joins, feedback upgrades and referrals are accepted for ever and the board never freezes. Spec 0008 line 38 says "Production keeps its date until the owner sets `CHALLENGE_ENDS_AT` empty and deploys", which is not what the code does; the owner would have to set it to the date to keep it. Meanwhile the versioned consent students agree to still says 30 October (known, flagged), so the recorded legal text and the running rule would disagree from that deploy on.
**Why it matters**: The deadline is 12 days away on a live contest with under 18 participants and a prize. A silent rule change through an unrelated deploy, against what students consented to, is the kind of thing that is hard to undo.
**Suggested fix**: Correct spec 0008's Production line, and either (a) set `CHALLENGE_ENDS_AT=2026-10-30T23:59:00+05:30` on production before any backend deploy from this branch, recorded as a deploy prerequisite in scope row 18, or (b) make production fail safe, for example a separate explicit "no end" value (`CHALLENGE_ENDS_AT=none`) so that a missing setting keeps the original date. Option (b) also covers the malformed value case below.

## Minor

### 🟡 A mistyped end date silently means "never ends", `packages/backend/convex/challengeRules.ts:9`
**Problem**: `endsAtOf` returns `null` for any value `Date.parse` rejects, with no log. `Date.parse` also accepts a date with no offset (`2026-10-30`, read as UTC midnight, 5.5 hours early) without complaint.
**Why it matters**: The setting exists to bring a deadline back; a typo turns it off and nobody notices until after the date.
**Suggested fix**: Treat a non empty value that is not a date with an offset as a configuration error (throw in the mutations or log loudly in the job), and require the offset in the format.

### 🟡 With no end date, pending referrals grow for ever and every 5 minute run rescans them, `packages/backend/convex/challengeBoard.ts:101`
**Problem**: Before, the deadline turned every leftover `pending` referral into `rejected`. Now a friend who never finishes, or an imported check (`decideReferral` keeps those `pending`), stays pending indefinitely, and each run pages through all of them, reading the step times for each.
**Why it matters**: The cost of the job grows without bound with the number of abandoned referrals. Small today, but it never shrinks.
**Suggested fix**: Reject imported checks outright (they can never count), and consider an age limit for a pending referral when no end date is set, or note the accepted growth in the spec.

### 🟡 The forwarded host guard is not exercised end to end, `packages/backend/convex/auth.ts:50`
**Problem**: AC-10 asks for convex-test coverage of each case; the tests cover only the pure functions in `trustedOrigins.ts`. Nothing proves the `onRequest` plugin is wired into `createAuth`, reads the right header, or runs before Better Auth resolves the base address. A rename or a dropped plugin entry would leave every test green.
**Why it matters**: This is the security relevant part of the change.
**Suggested fix**: Add one or two `t.fetch("/api/auth/get-session", { headers: { "x-forwarded-host": "evil.example" } })` cases with `BETTER_AUTH_TRUSTED_ORIGINS` set (expect 403) and one with an allowed host (expect not 403).

### 🟡 The allow list can lock out the site's own address, `packages/backend/convex/trustedOrigins.ts:33`
**Problem**: When a list is set, `allowedHosts` is the list only. If the list omits the host of `BETTER_AUTH_URL`, the funnel's own Pages forwarder (which sends `x-forwarded-host: dhirise.com`) is refused with 403, although that address is the fallback. The guard also does not look at `x-forwarded-proto`, which Better Auth trusts by default.
**Why it matters**: One missing entry when the list is first set on staging or production breaks sign in for everyone.
**Suggested fix**: Always add the host of `siteUrl` to `allowedHosts`, and drop list entries that are not addresses from `trustedOrigins` (or reject the setting), with a test for each.

### 🟡 Spec 0007 AC-14 now contradicts spec 0008, `docs/specs/_root/0001-one-platform/0007-thin-thread.md:28`
**Problem**: AC-14 ("no file under `apps/joining/` is edited") is said to still apply, but this change edits nine funnel files under spec 0008.
**Why it matters**: A later verify run will read AC-14 as failed, or worse, someone will trust it as proof the live funnel is untouched.
**Suggested fix**: Have spec 0008 state that it replaces AC-14's "no edit" clause for the listed files, and keep the rest of AC-14 (no production deploy, suites pass).

## Nits
- ⚪ `apps/joining/public/dhiinterviews/js/challenge-ui.js:15`, mixed versions during a deploy: an old `challenge-ui.js` or `leaderboard.js` with the new empty `endsAt` gets `NaN`, so the old invite closes at once (`!NaN` is true) and the old chip reads "NaNd". The `no-cache` rule in `public/_headers` makes this a deploy window race only; no action needed beyond deploying the config and scripts together.
- ⚪ `apps/joining/public/dhiinterviews/js/api.js:157`, the comment still says `endsAt (ms)`; it can now be `null`.
- ⚪ `apps/joining/src/pages/dhiinterviews/terms.astro:2`, the header comment "the words are unchanged" is no longer true.
- ⚪ `.env.example:5`, says the test form shows on `/thread`, which was removed; it is now on `/` and `/enter`.
- ⚪ `src/routes/dashboard.tsx:31`, hard codes `"/enter"` (twice) while `src/lib/entry.ts` exports the other paths as constants.
- ⚪ `src/routes/dashboard.tsx:37`, a failed sign out keeps the student on the page with no message, so Leave looks broken.
- ⚪ `scripts/funnel-local.mjs:120`, the dev proxy for the funnel's `/api/*` routes passes cookies and sends no `x-visitor`, unlike the Pages forwarders it stands in for, so local behavior of `/api/referral` differs from production (dev only).

## Strengths
- The rules that decide routing and access are pure, small and tested in isolation: `entryTarget` (every state, including the stale cookie case), `decideReferral` and `hasEnded` with an explicit `endsAt`, and `signInOrigins` / `isForbiddenForwardedHost`. Passing `endsAt` in instead of reading a module constant made the old suites keep testing the deadline rules exactly as before.
- `resolveFunnelFile` confines served files to the two funnel folders after decoding and resolving, so `..` and encoded traversal are refused, and the test covers it. The preview proxy replaces client sent forwarded headers rather than trusting them, and its test proves a forged host does not survive.
- `scripts/enter-check.mjs` refuses to run against anything but localhost or against the production deployment, and covers the under 18 path.
- The house stops fetching anything about a student until it is signed in, and the waiting screen shows nothing about anyone.

## Test coverage

Well covered: the end date rules on the server (set, unset, blank, malformed, exact second), the page side `endsAtMs` and `isOver` (`apps/joining/tests/challenge-end-date.test.js`), the front door rule, the initials helper, the auth proxy and preview proxy, and the funnel file server. Reported suites all pass (house 186 plus 38, backend 589, funnel 321, enter check 14 of 14).

Not covered: the `onRequest` guard wired into `createAuth` (see Minor), any check that the page end date and the server end date agree (see Major), the challenge pages' no end date rendering (hidden clock, hidden rule line, hidden chip) beyond the `api.js` helpers, and the `report-student.js` dashboard button (shown only with `dashboardUrl`, never in the saved copy). The Google round trip through `/enter` is known and flagged.

Known items I agree with and did not count: the challenge consent text still naming 30 October, the stale AGENTS.md files (root AGENTS.md still describes Nitro, Postgres and `pnpm build` running migrations), and the Google redirect seen only with the test form.
