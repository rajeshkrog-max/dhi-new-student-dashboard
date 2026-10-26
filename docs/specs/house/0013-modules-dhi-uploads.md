# 0013. Modules: DHI uploads, students watch and keep

**Date**: 2026-10-20
**Status**: In Progress

## Summary

DHI staff upload films. A DHI admin approves each one before students can see it, and a student cannot add a film. A student watches with their progress saved, so a reload or another device picks up where they stopped. The score for a film is written once, when playback reaches the end, and never again on a replay. Films are played from a private link on a video host, so large files stay off our backend.

## Requirements

**User stories**:
- As a DHI admin, I want to upload and approve a film so that only checked films reach students.
- As a student, I want my progress kept so that I can carry on from another device.
- As a student, I want the score written once, at the end, so that a replay does not add points.

**Acceptance criteria**:
- **AC-1**: A DHI admin uploads a film with a title, a category and a score value. It is hidden from students until the admin approves it.
- **AC-2**: A student has no upload control and no function that adds a film.
- **AC-3**: A student's progress is saved as they watch and survives a reload and a change of device.
- **AC-4**: The score for a film is written once, when playback reaches the end. A replay writes nothing.
- **AC-5**: A jump forward past the furthest point the server has recorded is refused by the server, not only by the screen.
- **AC-6**: An academic film carries two check questions tagged to its topic.
- **AC-7**: The video host link is private and expires. The film's file is never on our backend.

## Decision

**Chosen option**: DHI approves each film, films play from a private host link, progress and score are written by the server.

**Implementation skills**: none yet.

**Progress (2026-10-22)**: built with a stand-in host (a file in the house's own public folder; the Cloudflare Stream account is not ready, so a hosted id answers `host_not_ready`). `films.ts` and `moduleRules.ts`: DHI upload and approval, the student's list, the play link, the server's progress cap (about 1.25 times real time at most), the score written once with one `modules.kept` event, export and erase. 16 tests in `films.test.ts`. Screens: `modules/modules-real.tsx` and `staff/films-section.tsx`. `pnpm modules:check` passes 5 of 5 (the demo films come from `filmsProof:seedDemo`). Open: the Stream account and signed links, the institute room access check, and grading the check questions (not in v1).

## Rationale

Approval keeps unchecked content from students. The server recording the furthest point is what stops a student skipping to the end and claiming the score. A host link keeps storage and streaming out of our backend.

## Feature design

**Data model sketch**:
- `films`: `title`, `category` (one of the catalog codes), `scoreValue`, `status` (`pending`, `approved`), `hostRef` (the video host's id, never a public link), `uploadedBy`.
- `filmProgress`: `memberId`, `filmId`, `furthestSec`, `scored` (boolean), `updatedAt`. Index by member and film.
- `filmChecks`: `filmId`, `topic`, `question`, `answer` (server only).

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `films.upload` | mutation | title, category, score value, host id | the pending film | DHI admin | `forbidden`, `bad_title` |
| `films.approve` | mutation | film id | ok | DHI admin | `not_found` |
| `films.playLink` | query | film id | a short private link | student | `not_approved`, `consent_required` |
| `films.progress` | mutation | film id, seconds | ok, furthest seconds | student | `too_far`, `not_approved` |
| `films.finish` | mutation | film id | score written once | student | `not_finished` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Progress | the furthest point | the stored `furthestSec`, raised only by the server |
| Jump check | the allowed point | `furthestSec` plus a small allowance, from the server |
| Score | the score value | the film's `scoreValue` on the server |

**Key invariants**:
- A film is never shown to students before approval.
- The score is written once per student and film.
- The furthest point never decreases.

**Security model**: only DHI admins upload and approve. Students read approved films only. Links are short and private.

**Critical test scenarios**:
- A jump past the furthest point is refused by the server, verifies **AC-5**.
- A replay after the score writes nothing, verifies **AC-4**.
- A student cannot call the upload function, verifies **AC-2**.

## Build plan

1. The films tables and upload by DHI admin with approval (satisfies **AC-1**, **AC-7**).
2. The private play link (satisfies **AC-7**).
3. Progress saved and the server's furthest point (satisfies **AC-3**, **AC-5**).
4. The score written once at the end (satisfies **AC-4**).
5. Check questions for academic films (satisfies **AC-6**).

## Consequences

**Positive**: large files stay with the video host, and a student cannot skip to the score.

**Negative / tradeoffs**: playback depends on the video host.

## Follow-up

- [ ] Owner: choose the video host. The spec does not name one yet, and the play link depends on it.
- [ ] Confirm the score value for each category.

## Rationale

Options considered: our own file storage (rejected, cost and size), a video host with a private link (chosen), and public links (rejected, they leak).

## Owner answers and review fixes (2026-10-20)

**Owner answer**: films play from Cloudflare Stream with a private link. The price and student data terms still need checking before we commit.

**Builder fixes from review**:
- `films.upload` stores `durationSec`. The jump allowance is a fixed 10 seconds.
- `films.progress` caps the gain by the real time elapsed since the last server update, so a script cannot step forward in a loop.
- `films.playLink` and `films.progress` check the institute's room access.
- Academic films carry two check questions, entered at upload. Approval is refused without them. They are not graded in this version.
- "Module kept" means `scored` is true.
- The play link expires in 10 minutes or less.
