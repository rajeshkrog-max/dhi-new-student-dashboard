# 0014. Blog room, real, with teacher review

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A student writes a post with a title, a tag, one photo and a body that allows bold, italic and a numbered list. The author sees the post at once. Classmates in the same institute see it only after a teacher approves it. Every post and comment is reviewed by a teacher before it is public. The HTML is cleaned again on the server, so markup a student could slip past the screen is removed.

## Requirements

**User stories**:
- As a student, I want to write and see my own post at once so that writing feels quick.
- As a teacher, I want to approve, hide or remove posts so that the blog stays safe.
- As a student, I want to read the approved posts of my institute only.

**Acceptance criteria**:
- **AC-1**: A student writes a post with a title, a tag, one photo and a body. The body allows bold, italic and a numbered list only.
- **AC-2**: The server cleans the HTML of every post and comment with the same allowed tags as the screen. Disallowed markup is removed.
- **AC-3**: An unapproved post is visible to its author and to teachers of the institute only.
- **AC-4**: A teacher can approve, hide and remove a post. Only an approved post is visible to classmates.
- **AC-5**: A post never leaves its institute. A student of another institute cannot read it by any route.
- **AC-6**: A comment is plain text and is reviewed in the same way as a post.
- **AC-7**: The photo is stored once, and only its path is kept on the post. The room never pushes a student to write more.

## Decision

**Chosen option**: Every post and comment is reviewed by a teacher before classmates see it. The server cleans the HTML.

**Implementation skills**: none yet.

**Progress (2026-10-22)**: the server side is built in `blog.ts` with `blogRules.ts` (the server clean), `blogRoom.ts` (export and erase) and 13 tests (`blog.test.ts`). The student screen (`blog/blog-real.tsx`) and the teacher review (`staff/papers-section.tsx`, Reviews) are built and covered by `pnpm exams:check`.
- **Allowance**: 6 new posts an hour and 30 comments an hour for each student (`blogPost`, `blogComment`); a refusal is `slow_down`.
- **Event for the Brain** (`eventTypes/blog.ts`): `blog.published` {tag, words, list}, written once when a teacher first approves a post (`publishedAt` on the post), by the teacher as the actor, at the approval time. It holds the tag, the word count and whether a numbered list was used, never a word of the writing. A post hidden and approved again writes no second event; a later hide does not undo it, because the class saw the post.
- **Open**: the photo. The table can hold a stored file id, but no upload, no ownership check and no screen exist, so a post has no photo today. Decide with the owner whether photos are wanted at all before building them. The tag list is a first set (study, reflection, question, idea) awaiting the owner's list.
- **For the owner (privacy)**: a pending post is read by a teacher of the author's class before the class sees it, which is what the owner chose. The data wall in `accessRules.ts` lists writing as private to the student, so the blog review has its own path (not `staffRead`) and leaves no look record. The consent notice must say that a teacher reads a post before it is shared; the words are drafts until the owner approves them.

## Rationale

Teacher review before classmates see a post is the safest choice for students, and it matches the owner's answer. Cleaning the HTML on the server means the screen's rule cannot be bypassed.

## Feature design

**Data model sketch**:
- `posts`: `authorMemberId`, `instituteId`, `title`, `tag`, `body` (cleaned HTML), `photoPath` (optional), `status` (`pending`, `approved`, `hidden`, `removed`), `reviewedBy` (optional).
- `postComments`: `postId`, `authorMemberId`, `text` (plain), `status`.

**State transitions**: a post is `pending`, then `approved`, `hidden` or `removed` by a teacher.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `blog.write` | mutation | title, tag, body, photo path | the post | student | `bad_title`, `too_long`, `rate_limited` |
| `blog.list` | query | cursor | approved posts of the institute, and the author's own | student | `consent_required` |
| `blog.review` | mutation | post id, action | ok | teacher | `forbidden`, `not_found` |
| `blog.comment` | mutation | post id, text | the comment | student | `bad_text`, `not_approved` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| List | the institute | the student's own membership, never an input |
| Clean | the allowed tags | a fixed list shared with the screen |
| Photo | the path | the upload result, stored once |

**Key invariants**:
- A post is visible to classmates only when approved.
- The stored body has no disallowed markup.
- A post never leaves its institute.

**Security model**: a student reads and writes within their institute. A teacher reviews within their institute. No other role reads posts.

**Critical test scenarios**:
- A script tag in the body is removed on the server, verifies **AC-2**.
- A pending post is invisible to a classmate, verifies **AC-3**.
- A post of another institute is unreadable, verifies **AC-5**.

## Build plan

1. The posts table and the server clean (satisfies **AC-2**).
2. Writing and listing for the author (satisfies **AC-1**, **AC-3**).
3. Teacher review: approve, hide, remove (satisfies **AC-4**, **AC-5**).
4. Plain comments under the same review (satisfies **AC-6**).
5. Photo storage once (satisfies **AC-7**).

## Consequences

**Positive**: classmates see only checked posts, and the author always sees theirs.

**Negative / tradeoffs**: posts appear late for classmates, because a teacher must approve first.

## Follow-up

- [ ] Confirm the allowed tags list with the owner.
- [ ] Decide the photo size limit.

## Rationale

Options considered: teacher review of every post (chosen), review of reported posts only (rejected by the owner), and no review (rejected).

## Owner answers and review fixes (2026-10-20)

**Builder fixes from review**:
- Readers are the whole institute. Reviewers are the teachers of the author's class. Both are said in the spec's summary and the functions.
- The photo uses a server issued upload address. The server checks that the caller owns the stored file, its type and its size. `blog.write` no longer takes a client path.
- Add a comment review function under the same rules as posts.
- `blog.review` checks the post's institute and class.
- A copy scan proves the room shows no counts, streaks, reminders or nudge wording (AC-7).
- Add an event type for approved posts, and the export, erase and data map steps.

## Review fixes (2026-10-22)

**Photo** (`blogRules.photoFileProblem`, `blog.photoUploadUrl`): one photo a post. The server checks the stored file only by what the file store says: it exists, is 1 byte to 1.5 MB, was uploaded in the last hour, is not already held by another post or a profile picture (`by_photoId`), and if it declared a type, that type is JPEG, PNG or WebP. A file that declared no type is allowed, and is served with no picture type, so a page disguised as a picture is never run by a browser. The screen shrinks the picture to 1280 pixels and re-saves it as a JPEG. Only a student gets an upload address, 12 an hour.
- A teacher of the author's class sees the photo in Reviews before the classmates do. Classmates see it only once the post is approved.
- Removing a post deletes its photo at once, and erasing a student deletes their photos.
- The daily storage clean up (`reportCopy.sweep`) leaves a file held by a blog post or a profile picture alone (`isHeldByPicture`).

**Download**: a post says `hadPhoto: true` and carries no file or address. Comments are now in the download too: posts first (cursor `p:`), then comments (cursor `c:`).

**Brain event date** (owner answer, 2026-10-24): `blog.published` is dated to when the student wrote the post, not when the teacher approved it, so an approval on a quiet day never makes it a logged day and the expression note dates the post correctly. A post older than the event log accepts (7 days) is dated to the approval.

**Standing**: a student who withdrew vanishes from the blog for everyone else, as author and as commenter, and comes back when they restore. A teacher can still remove a withdrawn author's pending post.

