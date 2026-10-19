# 0006. Rationale: mood room, real, with the Vedic lens

## Context

The mood room is the first room to move from demo data in the browser to real server data. It must prove the whole path the other rooms will use: the verified student, the consent gate (spec house/0005), the shared event log (spec house/0004), and the student's rights to export and erase. Mood is logged daily and holds a student's feelings and their own words, so it is sensitive data of students under 18 in India. The log keeps only codes; the words must stay in the room's own table where only the student can read them. The demo screen already has ten moods, 20 DHI lines and a help button, and the scope asks for a guna lens and a daily rhythm tip on top. There is little time, so the design is the thinnest real path.

## Options considered

### Option 1: One table, two student only functions, one event type
A `moodDays` table with one row a day, `moods.save` and `moods.month`, and a `mood.logged` event written beside each save. The lens and tips are fixed words in code.

**Pros**:
- Smallest thing that meets every line of the Done when.
- Uses the log, the gate, the data map and the room registry exactly as designed.
- Wording can change without touching stored data.

**Cons**:
- Today only: no catch up for a missed day.
- The lens is a fixed map, not personalised.

### Option 2: No room table, store the note in the event
Put the mood and the note in the event payload and read the day back from the log.

**Pros**:
- One less table.

**Cons**:
- Breaks the log's rule that it holds no free text, and would put a student's words into a table built for counts.
- Makes erase, export and later formula changes harder to reason about.

### Option 3: Allow yesterday as well
Let a student log or edit the day before, marked late.

**Pros**:
- Forgiving for a missed day.

**Cons**:
- More rules and tests for little gain in a first slice; the log still allows it later without a rebuild.

## Rationale

Option 1 follows the rules the earlier rows set: the log owns the day, the retry and the "no free text" rule, and the room owns the words. It is the least to build and the easiest to prove end to end, which is the point of a tracer bullet room. Option 2 would undo the log's main safety rule. Option 3 can be added later because the log already allows 7 days. The guna lens is kept as a fixed map because nothing yet defines a better one; the owner approves the words before real students see them.
