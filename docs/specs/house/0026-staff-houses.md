# 0026. The staff houses

**Date**: 2026-10-28
**Status**: In Progress

## Summary

The staff area becomes a home for each staff role, in four parts the owner chose on 2026-10-27: a Home with what waits for each role, a teacher's page for one student (their papers), a DHI admin's overview of every institute, and a DHI admin's counselor roster. None of these opens a student's room data or the Brain to staff; named data goes only through `staffRead`.

## Requirements

**Owner answer (2026-10-27)**: all four parts.

**User stories**:
- As a teacher, I want to see what to mark, confirm and review the moment I open the staff area, and to look at one student's papers together.
- As an institute admin, I want to see which parent consents, invites and paused classes need me.
- As a DHI admin, I want every institute at a glance and one place to manage counselors.

**Acceptance criteria**:
- **AC-1**: A teacher's Home counts sittings to mark (submitted), marks to confirm (marked), blog posts and comments waiting from students of their classes, and their papers closing in the next two days. Another class's teacher sees none of it. A student and a counselor get nothing.
- **AC-2**: An institute admin's Home counts students under 18 whose parent's consent is not on file, invites not yet claimed and those ending in three days, and classes with their logins paused.
- **AC-3**: A DHI admin's Home counts films waiting, dishes waiting, desk questions that reached the model today, paused institutes and counselor invites not yet claimed. Each count has an Open button to its page. The staff area opens on Home.
- **AC-4**: The DHI admin's Overview has one row an institute: classes, students, staff, invites waiting, papers sent this month and desk questions this month. Counts only, never a name. Nobody else opens it.
- **AC-5**: The DHI admin's Counselors screen lists each counselor (name, email, active or paused, times open from now), invites a counselor, pauses and brings one back, and takes back an invite not yet claimed. Never a booking, a note or a student. Nobody else opens it.
- **AC-6**: A teacher opens "Papers" for a student of their class: every paper sent to them, newest first, with its confirmed mark and remarks, or missed, excused or not marked yet. Never an answer. It goes through `staffRead` (kind `academic`), so the student sees the look. Another class's teacher, an institute admin and a student are refused; a withdrawn student is not found.
- **AC-7**: The staff home's file reads no room table, the Brain, events, counseling bookings or desk words (a source scan).
- **AC-8**: The words are drafts (`STAFF_WORDS_APPROVED` is false) and pass the copy test.

## Decision

Counts are live queries (they are not named data, so they leave no view record), capped at 500. The per student page is a mutation through `staffRead`, beside the institute admin's class results in `papers.ts`. The roster reuses the existing invite, remove and reinstate functions, which a DHI admin may already call for a counselor. Two indexes are added: `paperSends.by_instituteId_and_sentAt` and `deskTurns.by_instituteId_and_createdAt` (the overview reads only counts from them).

## Feature design

| Function | Kind | Who | Output |
|---|---|---|---|
| `staffHome.todo` | query | teacher, institute admin, DHI admin (others `null`) | the role's counts |
| `staffHome.overview` | query | DHI admin | one row of counts an institute |
| `staffHome.counselors` | query | DHI admin | counselors with open times, and counselor invites waiting |
| `papers.studentForTeacher` | mutation | the student's class teacher | class name, and each paper's title, due day, state, mark and remarks |

**Screens**: the staff menu gains Home (first, for every staff role but a counselor), and for a DHI admin Overview and Counselors. A teacher's "My students" list gains a Papers button that opens the student's page in the side Sheet.

**Not done**: the DHI admin's screens cannot be opened in a browser proof, because a test inbox can never be a DHI admin (by design); `convex/staffHome.test.ts` covers them.

## Tests

`convex/staffHome.test.ts` (11: AC-1 to AC-7), `src/lib/dhi/staff-words.test.ts` (AC-8). Browser proof: `pnpm staff:check` (4 steps), `enter:check` (the new landing), the sweep's staff screens and `staff-home`, and an axe pass of the homes and the Papers sheet at 1280 and 360.
