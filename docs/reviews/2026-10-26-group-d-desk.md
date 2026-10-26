# Review: group D, the DHI desk (house row 15, and the desk part of row 16), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify ran on the development deployment `proper-camel-616` with made up students only; the desk called the real model there on the development key (about seven short calls a run). The review was done by a fresh model that did not write the code.

## Built in this pass (owner's decisions of 2026-10-26)

- A daily cap for the whole deployment: `deskDaily` (one row an India day), `DESK_DAILY_CAP` (default 300, `0` stops the model), refusal `desk_day_full`; the DHI admin's desk screen shows today's count and the cap.
- Each student's share of it: 20 questions to the model an India day (`deskStudentDay`, `DESK_STUDENT_DAILY`), refusal `desk_my_day_full`. Stored answers and the care text are free and never count.
- The off switch with no deploy: `DESK_LIVE` set to `false` (or unset) on the deployment.

## Verify

`pnpm desk:check` (new): 11 of 11, twice. A new student starts with 60 coins; one question of each kind costs exactly its price (chat 1, write 2, paper 2, mock 4, story 5, draw 8, so 38 left); a clarifying question is free; a distress message gets the care text with Tele-MANAS, costs nothing and stores nothing; the diagram is shown only as a `data:image/svg+xml` picture; a classmate asking the same question gets the stored answer for 0 coins.

## Tests added

Every desk function refuses the gate, a withdrawal, a removal, a paused institute, each staff role and a signed out caller, and no model is called; the daily cap (four cases); the per student share; the care text during a paper; the hashed cache key; the diagram length.

## Fresh review findings and how each was settled

| # | Finding | Settled |
|---|---|---|
| 1 | One student could use up the deployment's daily cap for everyone (free clarify questions count, 30 an hour) | The owner chose a share of 20 a day per student; built and tested |
| 2 | The cache kept the student's question as plain text, in a table never erased, and rows were never deleted | Fixed: the key is a SHA-256 hash of the normalised question (as spec 0016 says); the retention sweep deletes an answer after its 90 days (`deskCache.by_createdAt`). An answer can still echo words of a question for those 90 days; the personal check catches emails and phone numbers only. Named as a gap |
| 3 | The desk's exam lock read only a student's first 200 attempts | Fixed: it uses the same indexed check as the server exam lock (`examLock.hasOpenSitting`) |
| 4 | A diagram near the limit grew past it when `xmlns` and `viewBox` were added, and was stored cut short for 8 coins | Fixed: the length is checked again after the attributes |
| 5 | A distress message during a paper got `exam_open`, not the care text | Fixed: the care check comes first. It calls no model and stores nothing, so it cannot help with a paper |
| small | Deleting a talk while its question is pending returns the coins, but the model call still runs and counts toward the cap | Not changed: the answer is thrown away, so nothing is given for free; it is one wasted call inside the hourly limit |
