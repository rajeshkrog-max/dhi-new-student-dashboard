# 0022. Parent sharing and the weekly parent page

**Date**: 2026-10-24
**Status**: In Progress

## Summary

A parent may see a small weekly summary of the Brain, only when the student turns sharing on, through a private link the student makes and hands over themselves. The page holds how many days the student logged in each room over the last seven days and the three growth marks. It never holds a mood value, a note, a pattern, the support flag, or any sleep or meal detail. A parent has no account, DHI sends nothing, and no parent contact is stored. Built from scope row 18 to 22 (the Brain) and the sharing switch of spec 0005, after the owner's three answers below.

## Requirements

**Owner answers (2026-10-24)**:
1. May a parent see anything from the Brain at all? **Yes**, off by default; only the student turns it on.
2. Which items? **Days logged and the three lamps with their values** (0 to 100). Offered and not chosen: days logged only (the recommended option, because the lamps are built partly from low mood and sleep), and days logged with lamp movement. The words of the page therefore say a mark is "not a grade", and never show movement or a dip.
3. How does the report reach the parent? **A private page link the student shares.** Not email, so there is no parent email to hold, erase or send to.

**User stories**:
- As a student, I want to decide whether my parent sees anything, and to end it whenever I like.
- As a parent, I want a short weekly page that tells me how my child is keeping up, without a login.

**Acceptance criteria**:
- **AC-1**: With sharing off (the default) there is no link, `parentLink.make` answers `sharing_off`, and no code opens anything. Only a student makes, sees or removes a link.
- **AC-2**: The page holds the last 7 finished days (first and last day), for each of the 8 rooms how many of those days the student logged something in, and the three lamps as whole numbers 0 to 100 (or empty). It holds the first word of the student's name and the link's end date, and nothing else.
- **AC-3**: The page never holds a mood value, a note, a pattern, the expression note, the support offer, a lamp movement, an input behind a lamp, a sleep or meal detail, or another student's data. Until the student has logged on 5 of the last 14 days the lamps are empty (the same rule as the student's own Brain).
- **AC-4**: The link's code is 48 random hex characters, shown to the student once. Only its SHA 256 is stored. A student has at most one link; making a new one ends the old. A link lasts 90 days.
- **AC-5**: A link stops at once when the student ends it, turns sharing off, withdraws, is removed or erased, or the 90 days pass. Turning sharing on again does not bring an old link back. Every refusal reads the same (`gone`) so a stranger learns nothing, and wrong codes share one limit (120 a minute) that creates no key per code. Making a link is limited to 10 an hour for each student.
- **AC-6**: Making and ending a link write an access log row (`sharing.link`, `sharing.unlink`). A look through the link writes one view record with role `parent` (at most one an hour for one link), and the student's "Who has looked" shows it as "Parent" with the date.
- **AC-7**: The download carries the setting and the link's dates, never the code. Erasing a student deletes the link. The daily sweep deletes expired links.
- **AC-8**: `canView("parent", ...)` gives `summary` only for the `brain` kind and only when the student's setting is `summary`; for every other kind, standing or setting it gives `none`. No teacher, institute admin, DHI admin or counselor function reads the links or the page. The Brain's own files still use no access log (a parent look is written by `parentReport.ts`, not by them).
- **AC-9**: The words are drafts (`PARENT_WORDS_APPROVED` is false) in English and Hinglish, and pass the Brain's copy rules.

## Decision

**Chosen option**: the student's own secret link, resolved by one public mutation. Not a parent account (a parent sign in, an invite flow, a contact to verify) and not a weekly email (a parent address to store and erase, a provider, an unsubscribe route). The page is a live view of the last 7 finished days, so "weekly" means it shows the latest week whenever it is opened; nothing is sent, so no job runs on a schedule.

**Why a mutation**: a query cannot write the look record or spend the call limit.

**Why the code is after a `#`**: `/parent#<code>`. A browser never sends the part after `#` to a server, so it is in no log; the route also sends no referrer and is not indexed.

## Feature design

**Data**: a table `parentLinks` (`memberId`, `instituteId`, `codeHash`, `createdAt`, `expiresAt`, `lastLoggedAt`; indexes by member, by hash and by expiry), erase class `erased`. `viewLog.viewerRole` gains `parent`. Access log codes `sharing.link` and `sharing.unlink`. The setting itself stays in `sharingSettings` (spec 0005).

**Functions**:

| Function | Kind | Who | Output | Errors |
|---|---|---|---|---|
| `parentLink.mine` | query | student | `{ expiresAt }` or null | `forbidden` |
| `parentLink.make` | mutation | student | `{ ok, code, expiresAt }` | `sharing_off`, `slow_down` |
| `parentLink.remove` | mutation | student | `{ removed }` | `forbidden` |
| `parentReport.open` | mutation | anyone holding a code | `{ ok, firstName, expiresAt, week }` | `gone`, `slow_down` |

`sharing.set` to `none` deletes the link. `weekOf` (`parentRules.ts`) is the one place the page is built, from a short list of allowed fields. `accessRules.canView` answers the parent row before the private kinds check, because the Brain is private to every other viewer.

**Screens**: Your data gains "Make a link for my parent", the once only link with a copy button, the end date, "Make a new link" and "End the link". The parent page is `/parent` (a Worker route in `wrangler.jsonc`), in English and Hinglish.

## Checklist for the owner (not code)

- Approve the page's words (`PARENT_WORDS_APPROVED`, `src/lib/dhi/parent-words.ts`) and the Your data lines, with the other room words.
- Decide whether the lamp values should stay (option 3) or drop to days logged only (option 1): the lamps are partly built from low mood and sleep, so a low mark can reach a parent.
- Add the parent page to the legal check of the notice: a parent now sees a summary when the student turns it on.
- Production: the Worker route `dhirise.com/parent*` is added with the next `pnpm deploy:house`, which needs the owner's yes.

## Tests

`convex/parentSharing.test.ts` (21 tests, AC-1 to AC-8), `houseConsent.test.ts` (the `canView` table and the view record scan), `src/lib/dhi/parent-words.test.ts` (AC-9). The browser proof is left to the owner.
