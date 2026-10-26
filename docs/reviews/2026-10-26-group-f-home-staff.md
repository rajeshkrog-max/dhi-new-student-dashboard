# Review: group F, home and the DHI score, the bell, the staff screens and the class pause (house rows 23 and 24), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify ran on the development deployment `proper-camel-616` with made up people only. The review was done by a fresh model that did not write the code.

## Verify

Home and the score run in `brain:check` (8 of 8); the staff screens in `enter:check`, `consent:check`, `platform:check` and `exams:check`; the class pause in `parent:check` and the backend suite. The sweep found a steady layout shift on home (0.057 to 0.073 at 360, 1024 and 1280): the score card's values changed width when they arrived (from "…" to "Not yet" or a percent), so a line moved. Each value now keeps a fixed width; home, the dashboard shell, sleep, the study hour and modules are clean at all four widths.

The first class pilot (row 24): the pause is built and proven; the rest is the checklist in spec 0021, which is the owner's (see `docs/launch/OWNER-GATES.md`).

## Fresh review findings and how each was settled

The review found nothing on authorisation or privacy. Its findings were about the server exam lock built earlier in this run.

| # | Finding | Settled |
|---|---|---|
| 1 | The menu froze Your data and Leave for the whole window of a paper, which can be a day | Fixed: Your data and Leave are never frozen |
| 2 | The lock refused habit ticks and the study hour, and the Brain then scored those days as missed | The owner chose (2026-10-26): the lock closes only the rooms that could help with a paper (the desk, blog, study hour and films). Mood, habits, sleep, meals and Progress stay open, and a day an open paper touched gets no zero for the study hour (`examLock.sittingWithin`, metric version 7) |
| 3 | A seat in the study hour could not be left during a sitting | Fixed: leaving a seat is always allowed |
| 4 | A room's error card stayed after the frame moved to Exams | Fixed: the error card resets when the room changes, and the frame moves only away from a room the paper closes |
| 5 | The bell and home decide "open now" from the clock inside a query, so a paper that opens later shows late | Not changed: closing is covered by the sweep; an opening shows at the next change or reload. Named in the hardening file |
| 6 | The exam excuse and the Brain use the class the student is in now, not the class at the time | Not changed: rare (a move of class right after a paused window). Named in the hardening file |
