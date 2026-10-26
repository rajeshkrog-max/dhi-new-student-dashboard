# Review: group A, the platform (house rows 2 to 4), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify drove the real app on the development deployment `proper-camel-616` with made up people only. The review was done by a fresh model that did not write the code.

## Verify

| Check | Result |
|---|---|
| `pnpm enter:check` | 27 of 27, after the root `.env.local` was pointed back at the development deployment (a root `npx convex dev` on 2026-10-22 had pointed it at a local backend) |
| `pnpm consent:check` | 8 of 12 at first, then 12 of 12 after fix 1 below |
| `pnpm platform:check` (new) | 6 of 6 after fix 2 below. The DHI admin's move cannot run in a browser on purpose, because a test inbox can never claim a DHI admin role (`houseCore.mayClaimUnverified`); `memberMove.test.ts` covers it |
| `pnpm responsive:sweep` | no sideways overflow, small target or small text at 360, 768, 1024 and 1280. Layout shift over 0.05 on the live study hour and, slightly, on the dashboard shell, home and sleep, also when run alone: open for groups C and F |

## Bugs the verify found

1. Your data showed the DhiRise link card to a student who had withdrawn. `funnelLink.status` sits behind the consent gate, so it threw and the whole page fell to "Something went wrong". The card now shows only while consent is in place (`your-data.tsx`).
2. The download file dropped the funnel part: `joinExport` (`src/lib/dhi/your-data.ts`) copied only profile, consent and sharing from the header, so a linked student's file never held their answers. Fixed with a unit test.

## Fresh review findings and how each was settled

| # | Finding | Settled |
|---|---|---|
| 1 | `retention.sweep` passed `now` on as undefined, so a next page could run a different query than the one that made its cursor | Fixed: the first run's `now` goes on |
| 2 | The download left out four kinds of the student's own rows that the erase deletes: study hour chat messages, custom dishes, hidden patterns, the desk coin balance | Fixed: each is now a page of its room's export; `exportHolds.test.ts` |
| 3 | One class list could confirm up to 300 taken addresses against the cap of 50 a day | Fixed: after 50 taken addresses the later rows are not looked up and read `not_checked` |
| 4 | The team's parent erase request treated a missing under 18 flag as adult | Fixed: a missing flag counts as under 18, as at the gate |
| 5 | A removed student could be reinstated into a class archived meanwhile | Fixed: `class_archived` until they are moved to an open class |
| 6 | The parent page kept working while the student's class was paused, and the paused student could not turn sharing off | The owner chose (2026-10-26): the page reads as gone during a pause and opens again on resume. Staff views are unchanged |
| 7 | A withdrawn student cannot unlink the DhiRise check | Not fixed: the answers are the student's own, the link goes when they erase, and they can unlink once consent is back. Low harm |

## Tests added

`funnelLink.test.ts` (a withdrawn or paused student cannot read or make the link), `healthAccess.test.ts` (sleep, meals and food functions refuse every staff role, the gate, a withdrawal, a removal, a paused institute and another institute), `exportHolds.test.ts`, three cases in `houseReviewFixes.test.ts`, one in `parentSharing.test.ts`, the funnel part in `src/lib/dhi/your-data.test.ts`.
