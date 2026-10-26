# Review: group E, the Brain and the parent page (house rows 17 to 22, specs 0019, 0020, 0022, 0023), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify ran on the development deployment `proper-camel-616` with made up students only. The review was done by a fresh model that did not write the code.

## Verify

| Check | Result |
|---|---|
| `pnpm brain:check` | 8 of 8, and again after the fixes |
| `pnpm parent:check` (new) | 6 of 6. A fresh student with a steady month makes the private link; it opens with no sign in and shows only the days logged and the three lamps; the look shows in the student's own record; the page reads as gone while the class is paused and comes back on resume; removing the link ends it; a second student with forty seeded days sees the bedtime and mood connection on Progress (new seed scenario `connected`) |

## Tests added

`brainWall.test.ts`: every Brain function refuses each staff role; the access rule gives no staff viewer anything of the kind `brain`; a scan finds every file that reads the Brain and proves none lets a staff role in or calls a staff path. The connected seed shows its connection; a withdrawal and a removal end the parent link for good.

## Fresh review findings and how each was settled

| # | Finding | Settled |
|---|---|---|
| 1 | The bedtime and mood connection could never fire on real data: it asked whether `E06L` exists, and every mood day writes all three bands | Fixed: it reads `E06L.num === 1`. The engine test and the seed now write all three bands, as real days do |
| 2 | A parent link came back to life after a withdrawal and a new agreement, or a removal and a reinstatement | Fixed: either side's withdrawal and a removal delete the link (`dropLinks`); the student makes a new one if they want |
| 3 | The connections read 119 finished days, not 120 | Fixed |
| 4 | An event committed late, just before the cursor of a capped rollup pass, can be skipped | Not changed: a capped pass must move on without a look back, or a burst would be read again forever. The nightly close heals the last two days and the check counts the rest |
| 5 | Parents of a paused class used the shared wrong code allowance | Fixed: the pause answer no longer takes from it |

What held: no staff function reads a Brain day, a hide, a pattern, a lamp or a connection; the parent page holds only `weekOf`; the code is 48 characters, only its hash is stored, it lasts 90 days; zeros only after a day ends and never on a paused day; the thresholds are named; the two owner gates are false and respected; the statistics are seeded.
