# 0008. Sleep room, real: rationale

## Context

Row 7 of the house scope asks for a two tap sleep log: a bed time and a wake time, prefilled from yesterday, with sleep length and usual bedtime read back, a night with no log staying "not logged", and each entry reaching the event log. The scope left one decision open: whether sleep lives in its own card or inside Habits or Mood. No room records sleep today, and the research brief leans on it more than on any other signal.

The forces: the event log accepts only ids, numbers, booleans and fixed codes, so the event must carry numbers. The day rule is 04:00 to 04:00 India time, so a night that starts at 01:00 must not land on the wrong day. Students are often under 18, so the consent gate, the privacy walls and the "never label a student" rule apply. Mood (house spec 0006) and Habits (0007) have already set a pattern for server days, one clock read, a code only event, export and erase, and a live race proof.

## Options considered

### Option 1: Its own room
A new card and menu entry, a `sleepNights` table, a `sleep.logged` event and two functions (`save`, `recent`).

**Pros**:
- Two times and a length fit a row built for them; the goal "length and usual bedtime read back" is natural.
- Its own export, erase, privacy scan and rate limit, like every other room. The room code `sleep` and the data kind `sleep` already exist.
- Mood and Habits stay untouched, so their edit rules and tests do not change.

**Cons**:
- One more screen and one more menu entry.
- A new table and a new event type to carry.

### Option 2: Inside Habits
Reuse the habit kind `sleep`, a daily tick.

**Pros**:
- Almost no new screen, and the streak helpers already exist.

**Cons**:
- A tick has no times, so a bed time, a wake time and a usual bedtime cannot be stored or read back.
- A habit is a choice the student makes for a window of days; a night's sleep is a fact about last night.

### Option 3: Inside Mood
Add bed and wake times to the mood day.

**Pros**:
- One card fewer, and sleep sits beside how the student feels.

**Cons**:
- Ties two private records together: a mood change would rewrite sleep, or the reverse.
- The mood row's edit rules (10 mood changes, free note) do not match a night's.
- The events would mix two rooms' types in one row.

## Rationale

Option 1. The scope's own goals (length, usual bedtime, a night that stays not logged) need stored times, which only a table of its own can hold without bending the other rooms. The event log's number only rule is met by two whole numbers, and the codes for the room and the data kind are already in place, so the cost is the smallest of the three real fixes. Keeping sleep apart also keeps the privacy and erase rules simple: one table, one entry in the data map, one reader.

The other choices follow the same logic. A night is filed under the house day on which it is saved, because the server cannot know when the student woke and the house day ends at 04:00, so a 01:00 bed time still lands with the night that ended that morning. A student who saves twice before 04:00 changes that night rather than making a second one. Only the server's day can be saved, as in Mood and Habits, so history is stable and the log means the same thing every time. The event carries raw numbers rather than a band such as short or long, because a band is a label, and a label on a student is what the house rules forbid; the Brain can choose its own cut points later from the numbers. The room holds no free text, which removes the hardest privacy case. The usual bedtime is a median, because one late night should not move it, and it is shown only from 3 nights so that one night is never called "usual".

## References

**Project sources** (verifiable, in this repo):
- Specs house/0004 (event log and day rules), 0005 (consent, privacy and access record), 0006 (Mood room), 0007 (Habits room).
- `packages/backend/convex/eventShapes.ts` (the field kinds an event may use, the `sleep` room code) and `accessRules.ts` (the `sleep` data kind in the `wellbeing` class).
- `BACKEND.md` and the root `AGENTS.md` (never label a student weak, average or bright).
