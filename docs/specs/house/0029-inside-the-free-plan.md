# 0029. Staying inside the Convex free plan

**Date**: 2026-10-28
**Status**: In Progress

## Summary

Convex warned that the team's projects are near the free plan's limits. The free plan is shared by the whole team and counts, each month, 1,000,000 function calls (every scheduled run is one) and 1 GB of database reads and writes, with 20 GB-hours of action compute and 0.5 GB of storage. On the free plan, going over can make new writes fail. Three steady costs were found that grow with time, not with use, and all three are fixed: two jobs that read the same rows again and again for ever, and six jobs that each ran every minute whether there was work or not.

## Requirements

**Owner's ask (2026-10-28)**: make it robust so the free plan limits are not hit.

**What was found**:
1. The Brain's minute pass (`brainRollup.run`) kept its cursor at the last event, and each pass looks back a minute from the cursor, so the newest event was read again and its student's whole day rebuilt every minute, for ever, on every deployment.
2. The rebuild of days under an older formula (`brainRollup.rebuildStale`) paged through every stale day every 10 minutes. Days it cannot rebuild (a student who withdrew or was removed) stay stale, so it read them all again each time: about 800 days in some 20 runs every 10 minutes on development.
3. Six jobs ran every minute (the report copy, the study hour seats, the exam sittings, the Brain's pass, the desk's waiting questions and its idle sittings): about 259,000 calls a month a deployment with nobody in the house, and development and production both run them.

**Acceptance criteria**:
- **AC-1**: A complete Brain pass moves its cursor to the end of the range it read; a pass with no new event writes nothing. An event is read in at most two passes.
- **AC-2**: A rebuild pass that reaches the end records the formula version and the time. While both are current, the days it left behind are tried again once a day, not every 10 minutes. A new formula starts a pass at once.
- **AC-3**: One minute job (`minuteTick.tick`) replaces the six minute jobs and the 10 minute rebuild. It asks each job's own check (one indexed row, kept beside the job) and schedules only the jobs that have work; every tenth minute it also asks about stale days. An idle deployment costs one call a minute. Each job is unchanged and still continues itself when its batch is full.
- **AC-4**: A test keeps the minute job the only cron that runs every minute.

**Expected effect (idle, each deployment, a month)**: about 61,000 calls (the tick, the funnel's two five minute jobs and the dailies) instead of more than 330,000, and the steady reads of points 1 and 2 gone.

## Tests

`minuteTick.test.ts` (idle starts nothing; each job starts only when its check finds work; the stale days on the tenth minute and the day long wait; the cron scan) and a cursor test in `brainRollup.test.ts`. The browser proofs that lean on the jobs pass: hour, exams, topics, brain.

## Still open

- The real usage numbers are on the Convex dashboard (team `subs-dhi`, Usage), which only the owner can open. Look again a week after the deploy.
- The funnel's two five minute jobs (the Sheet copy and the challenge) are unchanged: each stops after one or two reads when it has nothing to do.
- Heavy use later (many students) will grow the reads of the rooms themselves; the staff Home reads up to 500 rows a look. That is a cost of use, not of time, and is for the paid plan question when the pilot grows.
