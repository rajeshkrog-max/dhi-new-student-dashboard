# 0009. Food table and the Indian plate catalog

**Date**: 2026-10-20
**Status**: In Progress

## Summary

The Meals room needs a trusted list of foods. Each food has its energy, carbs, protein and fat per serving, a food group and a processing tag. The numbers come from open licence food data, and every source's licence is checked before any of its data is loaded. A student who adds a custom dish gives its numbers, and the dish counts for them straight away. The DHI team can then publish that dish to everyone's list. Students never see calorie totals or targets.

## Requirements

**User stories**:
- As a student, I want to find a dish by its name in English or Hindi so that logging a plate is quick.
- As a student, I want to add a dish that is not in the list so that my real meals can be logged.
- As DHI, I want to publish a checked custom dish to everyone's list so that other students can use it.
- As the owner, I want every number to name its source and licence, so that we never show data we are not allowed to use.

**Acceptance criteria**:
- **AC-1**: The catalog holds items with a name (English and Hindi spellings), energy in kcal, carbs, protein and fat in grams per serving, a food group (grain, dal or protein, vegetable, dairy, fruit) and a processing tag (home cooked, packaged, fried). Every item has a food group and a processing tag.
- **AC-2**: Each catalog item names its source and that source's licence. An item whose source licence is not confirmed is not loaded.
- **AC-3**: Search by dish name finds an item by an English or a Hindi spelling, and the search ignores case and extra spaces.
- **AC-4**: A student may add a custom dish with its own numbers and a food group and processing tag. The dish is saved for that student and counts for its food group straight away.
- **AC-5**: A custom dish is marked as entered by the student and is never shown as checked. It shows on other students' lists only after the DHI team publishes it.
- **AC-6**: Only a DHI admin may publish a custom dish to the shared catalog. Institute admins, teachers and students cannot.
- **AC-7**: Numbers are stored, but no screen in this spec shows a calorie total or a target. The student-facing numbers are the Meals room's food group counts (spec 0010).

## Decision

**Chosen option**: Open licence food data, from the four candidate sources, each checked before use. A custom dish is entered by the student and counts for them at once. DHI publishes a dish to everyone when it chooses.

**Implementation skills**: none yet.

**Progress (2026-10-20)**: built without any catalog items, as you chose (the catalog loads when the licences are checked). `foods.ts` and `foodRules.ts` hold search by English or Hindi name or alias, custom dishes with the student's own numbers, and DHI publishing into the catalog with the source "DHI checked". A search returns no numbers. The DHI admin's publish screen is built (`staff/foods-section.tsx`). Tests are in `meals.test.ts`. Still open: the licence checks and the first catalog import.

## Rationale

The student's own numbers count at once, so the room is quick and honest about what the student ate. Publishing is a separate step for DHI, so no unchecked number reaches every student. Licence checking comes first because a dataset we cannot legally reuse would have to be removed later.

## Feature design

**Data model sketch**:
- `foods`: `id`, `nameEn`, `nameHi` (optional), `group` (one of five codes), `processing` (one of three codes), `energyKcal`, `carbsG`, `proteinG`, `fatG` (per serving), `serving` (text), `source` (text), `licence` (text), `status` (`catalog` or `custom`), `ownerMemberId` (for a custom dish, optional), `publishedBy` (optional), `publishedAt` (optional). Index on `nameEn` and on `nameHi`.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `foods.search` | query | `text` | up to 20 items, no numbers shown to students | student | `bad_query` |
| `foods.addCustom` | mutation | name, group, processing, four numbers, serving | the new dish | student | `bad_name`, `bad_number`, `rate_limited` |
| `foods.publish` | mutation | `foodId` | ok | DHI admin | `forbidden`, `not_found` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Search | the matching items | the `foods` index, filtered by the text |
| Add custom | the dish's numbers | the student's input, checked to be finite and not negative |
| Add custom | the owner | `requireMember`, never an input |
| Publish | the publisher | `requireMember` (DHI admin), never an input |

**Key invariants**:
- A catalog item always names a source and a licence.
- A custom dish never has `status` `catalog`.
- A student sees the numbers of a catalog item and of their own custom dishes only.

**Security model**: students read the catalog and write only their own custom dishes. Only a DHI admin publishes. Staff screens do not list student custom dishes.

**Critical test scenarios**:
- Search in English and Hindi finds the same dish, verifies **AC-3**.
- A custom dish counts for its group at once, and does not appear on another student's list, verifies **AC-4**, **AC-5**.
- An institute admin's publish is refused, verifies **AC-6**.

## Build plan

1. Confirm each candidate source's licence and record the result in the spec before loading any data (satisfies **AC-2**).
2. Create the `foods` table and the import of the checked items (satisfies **AC-1**).
3. Build `foods.search` with English and Hindi matching (satisfies **AC-3**).
4. Build `foods.addCustom` and the custom rules (satisfies **AC-4**, **AC-5**).
5. Build `foods.publish` for DHI admins (satisfies **AC-6**).
6. Tests and a proof that no screen shows a calorie total (satisfies **AC-7**).

## Consequences

**Positive**: one trusted list serves every Meals entry, and custom dishes cover what the list does not.

**Negative / tradeoffs**: a student's own numbers may be wrong. The screen will say they are the student's own. Licence checking may cut the list short, so coverage depends on what is allowed.

**Neutral**: the Hindi spellings need a list we write ourselves, since no source is confirmed for them yet.

## Follow-up

- [ ] Owner: check the licence of each candidate source (INDB by Jaacks Lab, IFCT 2017, the Mendeley packaged foods set) and record the result. Nothing is loaded until this is done.
- [ ] Owner: confirm the DHI team member who publishes custom dishes.
- [ ] Decide how many items the first import holds once the licences are known.

## Rationale

Reasoning is in the decision record above. Options considered were open licence data (chosen, with licence checks), a hand checked list only, and a paid database.

## Owner answers and review fixes (2026-10-20)

**Owner answers**: a custom dish gets its numbers from the student and counts for them at once. DHI can publish it to everyone's list. The scope row for row 8 is updated to match.

**Builder fixes from review**:
- Publishing copies the dish into a new catalog row with source "DHI checked" and licence "DHI own", and no owner identity.
- `foods.search` never returns another student's unpublished dish or its owner. Students see only catalog items and their own custom dishes.
- `foods.addCustom` goes through the consent gate and returns `consent_required` when it fails.
- Hindi matching covers both Devanagari and romanised spellings, using stored aliases.
- Rate limits for search and add use the shared limiter values, named in `limits.ts`.
- `meals.log` refuses another student's custom dish as `not_found`.
- DHI admin gets a list of unpublished dishes to choose from, showing dish names only.
