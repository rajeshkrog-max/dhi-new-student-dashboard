# Review: group B, the health rooms (house rows 5 to 9), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify ran on the development deployment `proper-camel-616` with made up students only. The review was done by a fresh model that did not write the code.

## Verify

| Check | Result |
|---|---|
| `pnpm mood:check` | 10 of 10 |
| `pnpm habit:check` | 9 of 9 |
| `pnpm sleep:check` | 11 of 11 |
| `pnpm meals:check` | 5 of 6 at first: its last step still looked for the desk's old coming soon page. The step now checks that the real desk opens and shows the coins. Then 6 of 6 |

The food table has no browser proof of its own: a student's custom dish runs inside `meals:check`, and the DHI admin's publish runs in `meals.test.ts`, because a test inbox can never be a DHI admin.

## Tests added

`healthAccess.test.ts`: every sleep, meals and food function refuses each staff role, a signed out caller, a student at the gate, one who withdrew, a removed one and one of a paused institute, and a student of another institute sees none of this student's rows.

## Fresh review findings and how each was settled

| # | Finding | Settled |
|---|---|---|
| 1 | Publishing a dish left the student's own row as custom: it stayed on the waiting list for good, could be published again and again, and the student found it twice | Fixed: the row becomes `published`; the waiting list empties; a second publish is `not_found`; the student finds the catalog copy once |
| 2 | `addCustom` took its limit before checks that throw, so a refused try gave its token back; `meals.remove` had no limit | `meals.remove` now shares the logging limit. `addCustom` now checks first and takes the limit only for a dish that is added, which is what it did in effect; a refused try costs no write |
| 3 | A change of the note alone wrote no event, but the event holds the word count the Brain reads for its note days | Fixed: a note edit that changes the word count writes a replacing event with its own key counter (`moodDays.noteEdits`, optional, additive). Spec 0006 AC-2 said the old rule and is stale on this point |
| 4 | The meals day and week queries read the clock, so a screen left open did not turn at 04:00 | Fixed: the screen keeps its own house day, moved on at 04:00, and passes it, so the queries run again |
| 5 | A plate logged for yesterday (allowed up to a day back) could not be removed anywhere; a form left open over a day sent a stale time | Fixed: the day view lists yesterday's plates with Remove; the time resets after each saved plate |
| 6 | A day's plates were read 200 at a time before removed ones were skipped | Fixed: 500, the event log's cap of a day |
| 7 | Search reads 500 catalog items and 200 own dishes, then filters | Own dishes are now the newest 200. The catalog is empty until the licence checks, so a search index is a gap for the first import (`docs/launch/HARDENING.md`) |
| 8 | Removed plates exported like live ones; the data map's note on foods was out of date | Fixed: a plate row carries `removed`; the data map note now says the student's own dishes are exported and erased |
