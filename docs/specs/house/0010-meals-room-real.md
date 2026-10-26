# 0010. Meals room, real

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A student logs each plate on the server: the item, a count (for example rotis), the meal (breakfast, lunch, dinner or snack) and the time. Custom dishes are allowed. The room shows the day's balance as a count of items in each food group, never a calorie total or a target. A meal at 01:00 counts for the day before, under the house day rule.

## Requirements

**User stories**:
- As a student, I want to log a plate and see it after a reload so that my day is kept.
- As a student, I want to see what food groups I have had today so that I can notice my own balance.
- As the owner, I want no screen to call food good or bad, or to show a calorie total, so that the room never pushes eating less.

**Acceptance criteria**:
- **AC-1**: A student logs a plate: a food from the catalog (spec 0009) or a custom dish, a count, a meal and a time. The server stores it and it reads back after a reload.
- **AC-2**: The day of a plate is the house day (04:00 to 04:00 India time) of its time. A meal at 01:00 lands on the day before.
- **AC-3**: The room shows the day's count of items in each food group. No calorie total, no protein total and no target appears anywhere in the room.
- **AC-4**: The wording of the room never says eating less, skipping a meal or a food being good or bad helps or harms.
- **AC-5**: A student may remove a plate they logged. The removal is recorded in the event log with a code only.
- **AC-6**: Each logged plate writes one event holding only the meal and the food group codes, never the dish's name.
- **AC-7**: Staff see a student's meals only as a class count through the existing class total rule, never a named plate.

## Decision

**Chosen option**: A new Meals room table, with functions that read the catalog from spec 0009. The day balance is a count of items per group, computed when the student looks.

**Implementation skills**: none yet.

**Progress (2026-10-20)**: built. `meals.ts` logs a plate with the time eaten, shows the day's food group counts and the last seven days, and removes a plate by voiding its event. The screen (`meals/meals-real.tsx`) shows group counts and no calorie total. Covered by `meals.test.ts` (15 tests) and `pnpm meals:check` (5 steps). Open: the wording check with the owner, and a catalog to search (until then only custom dishes exist).

## Rationale

Counts of groups tell a student what they ate without a number they might chase. Keeping the dish name out of the event matches the rule for every room. Using the house day keeps late meals on the right day.

## Feature design

**Data model sketch**:
- `mealPlates`: `memberId`, `instituteId`, `day` (house day), `meal` (one of four codes), `time` (ms), `foodId` (optional, catalog or custom), `customName` (optional, the student's own words), `group` (one of five codes), `count` (1 to 20, whole number), `removedAt` (optional). Index `by_memberId_and_day`.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `meals.log` | mutation | food id or custom name and group, count, meal | the plate | student | `bad_count`, `bad_meal`, `not_found`, `rate_limited` |
| `meals.day` | query | none (today) | plates and group counts | student | `consent_required` |
| `meals.remove` | mutation | plate id | ok | student (own plate) | `not_found` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Log | the day | the server clock through the house day rule, never an input |
| Log | the group | the catalog item's group, or the custom dish's group |
| Day | the group counts | summed from the day's plates at read time |

**Key invariants**:
- A plate's day is the house day of its time.
- The room shows counts only, never a total of energy or protein.
- The event holds the meal and the group codes only.

**Security model**: a student reads and writes their own plates. Staff see class counts only through the existing class total.

**Critical test scenarios**:
- Log, reload and read back, verifies **AC-1**.
- A plate at 01:00 lands on the day before, verifies **AC-2**.
- The room holds no calorie or protein total, verifies **AC-3**.

## Build plan

1. The `mealPlates` table, the meal and group codes, and the house day on each plate (satisfies **AC-2**).
2. `meals.log` for catalog and custom plates (satisfies **AC-1**, **AC-6**).
3. `meals.day` with the group counts (satisfies **AC-3**).
4. `meals.remove` and its event (satisfies **AC-5**).
5. Export, erase and the data map (satisfies **AC-7**).
6. The screen on the shared kit, the wording rule, and a proof (satisfies **AC-4**).

## Consequences

**Positive**: the room is simple and never judges food.

**Negative / tradeoffs**: a count of groups says less than a total, so some students may want more detail. That is intended.

## Follow-up

- [ ] Confirm the wording of the screen with the owner before real students see it.
- [ ] Confirm the removal rule: whether a removed plate stays in the event log (the current plan says yes, as a void).

## Rationale

Options considered: a total of energy with a target (rejected, the scope forbids it), a count of groups (chosen), a picture of a plate (possible later, not in this row).

## Owner answers and review fixes (2026-10-20)

**Builder fixes from review**:
- `meals.log` takes `eatenAt`, no later than now and at most 24 hours back. The server works out the house day from it, so a student can log breakfast after the fact.
- A custom dish is always a food row (spec 0009). `meals.log` no longer takes a free custom name or a group, so there is one way to log a custom dish.
- Add `meals.week`, so the week view shows the week while the day resets.
- Build step 5 is linked to AC-7 (staff see class counts only).
