# 0007. Rationale: habits room, real

## Context

The habits room is the second room to move from demo data in the browser to the server, after Mood (spec house/0006). The demo keeps up to five plans per student, with a title, a colour, a start and end day, and a daily tick; a miss is a day in the window with no tick and history is never rewritten. It must now use the verified student, the consent gate (spec house/0005), the shared event log (spec house/0004), the student's export and erase, and the data map. A habit's title is the student's own words, so it stays in the room's table and never enters the log. The scope asks that a sixth habit is refused by the server, that ticks survive a reload, that a tick on a future or closed day is refused, and that each tick reaches the event log. The demo also deletes a habit with its ticks and lets the screen pick any start day, both of which clash with "history is never rewritten" and with the day rule.

## Options considered

### Option 1: Two tables, today-only ticks, derived numbers on the screen
`habitPlans` and `habitChecks`, student only functions, a tick and an undo as events (undo as a void), and streaks computed from the ticks when the screen is drawn.

**Pros**:
- Matches the demo's own data shape (plans and checks) and the scope's words.
- Nothing derived is stored, so streak or milestone rules can change without a data fix.
- Reuses the log's day rule, retry rule and void for an undo.

**Cons**:
- Today only: no catch up for a missed day.
- The screen does the streak work, so it must be given the ticks for a habit's window.

### Option 2: Store the streak and tally on the plan
Keep a running streak and counts on each plan, updated on every tick.

**Pros**:
- Smaller reads.

**Cons**:
- Stored derived values go stale and need repair when a rule changes; an undo or a late fix must be reversed correctly.

### Option 3: Allow yesterday as well
Let a student tick the day before, marked late.

**Pros**:
- Forgiving for a forgotten tick.

**Cons**:
- Contradicts the scope ("a tick on a closed day is refused") and weakens the honesty of a miss.

## Rationale

Option 1 is the least to build and follows the rules the earlier rows set: the log owns the day, the retry and the "no free text" rule, and the room owns the student's words. Derived numbers are never stored, which is the log's own principle. Option 2 would add a second place where the truth lives, and Option 3 conflicts with the scope. Removing a habit ends it and keeps its rows, so a miss and a streak can always be rebuilt and only the student's erase deletes them.
