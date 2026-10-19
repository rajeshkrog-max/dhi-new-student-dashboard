# 0004. Room event log and day rules (decision record)

Context, options and rationale for [the build spec](./index.md).

## Context

**Workspace**: the shared backend (`packages/backend`), repo wide for the house, no screen of its own. Scope: `docs/scope/house/platform.md`, row 3. Stack: Convex with `convex-test`, the shared rate limiter and `requireMember` from house spec 0002 (which this spec assumes is built: `members` and their `joinedAt` exist).

The Master Spec (13 October 2026) fixes the shape of the problem: every number on every report is rebuilt from one log of events, each written by a room's server function in the same transaction as the room's own row. A day runs 04:00 to 04:00 India time, so a meal at 1 am belongs to the day before. A day with no log is stored as not logged, never zero. Every job is idempotent, so a rerun never counts twice. A wrong number on a parent's or a principal's report costs more trust than any feature earns, so the base has to be exact before anything is built on it.

Eleven rooms are still demo screens that keep their data in the browser. Every one of the next rooms needs the same four rules (which day, what counts as logged, what a retry does, how a correction is recorded). If they are not decided once, each room invents its own, and the Brain later reads numbers that mean different things in different rooms. Many students are under 18, so the log is also where private writing could leak (a mood note, a blog post) if it were allowed to hold free text. The consent and access rules are house row 4 and do not exist yet, so the log must be safe before they do.

If nothing is decided, rows 5 to 16 each build their own idea of a day and of a retry, and row 17 has to reconcile them.

## Options considered

### Option 1: One append only events table, written by server helpers inside each room's function (chosen)

A single `events` table. A room calls `recordEvent` in the same transaction as its own write. The log owns the day rule, the retry rule, the late rule and the correction rule. Events are never changed. The browser has no access. It holds ids, counts and codes only.

**Pros**:
- One place for the rules, so every room agrees and the Brain reads one meaning.
- Atomic with the room's own row, so the log cannot disagree with the room.
- Append only means a changed formula can always rebuild from what was first logged.
- No browser access and no free text, so it is safe to build before the consent rules exist.

**Cons**:
- Every room must call the helper and register its types.
- Reading "the current event for a thing" needs the replace chain.
- A bug in a registry entry shows as a room that cannot save.

### Option 2: A public "add event" function the browser or rooms call

Rooms (or the browser) call one public mutation to add an event after saving their own row.

**Pros**:
- Simplest for room builders, and one call from anywhere.

**Cons**:
- The browser could send events for things that never happened, which would poison every number.
- Two writes in two calls can half succeed, so the log and the room disagree.
- Gives the browser a write surface on data about minors for no gain.

### Option 3: No event log; compute numbers straight from each room's own tables

Skip the log. The Brain reads mood, meals, habits and the rest where they live.

**Pros**:
- No new table and no extra write.

**Cons**:
- Every room stores its data differently, so every metric needs its own reader and its own idea of a day.
- A room's edit can silently change history, so a number cannot be rebuilt.
- The Master Spec's "rebuild any number from events" and its reconciliation check become impossible.

### Option 4: The log and the daily values built together

One feature that stores events and also computes numerators and denominators as events arrive.

**Pros**:
- Fewer steps until a number exists.

**Cons**:
- Freezes metric formulas before any room exists, so each metric change reaches into the log.
- Much bigger, and it hides whether a wrong number came from the log or from a formula.
- Daily values are row 17, which can then be rebuilt freely from a stable log.

## Rationale

Option 1 fits the forces. The Master Spec already names the log as the source of truth and says it is written beside each room's own row, which only a server helper in the same transaction can guarantee (Option 2 cannot, and Option 3 gives up the rebuild). Keeping the feature to the log and the day rules (against Option 4) matches the Tracer Bullet approach: the log is the thin, stable ground, and daily values, which change as metrics are tuned, sit on top and can be rebuilt without touching it.

The privacy rules come from who the students are. Allowing only ids, counts and codes in a payload means the log can exist before house row 4 decides who may read events, because it cannot carry a student's own words in the first place. Having no browser access at all removes a whole class of abuse (a fabricated event) and means nothing about reads or erasure has to be settled in this row.

The small rules each close a specific failure. A server worked day, never taken from the caller, stops a room from counting a meal for the wrong day. A retry that is stored once, and a different body for the same key refused, makes double counting impossible and shows a buggy room at once. Corrections that stay on their day and a 7 day ceiling keep every day's history honest and mean a closed day stays closed. A 500 a day cap stops a runaway loop from filling the table. The India time rule is fixed for everyone because every institute is in India and India has no daylight saving, so no per institute zone is needed.
