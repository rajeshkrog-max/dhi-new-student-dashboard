# Review, house/people-roles-invites (uncommitted work: the Brain, exams, blog, home), 2026-10-22

**Reviewed by**: Claude Opus (author on Claude Sonnet 5.5). A second, short review of the fix diff is recorded at the end.
**Scope**: the uncommitted working tree on branch `house/people-roles-invites`: the Brain (house specs 0019, 0020), papers and exams (0011, 0012), the blog (0014), the study hour (0015) and the home (0017), with the class pause (0021).
**Verdict**: Changes requested, then fixed in code. The fixes were first run on 2026-10-24 (see "What was done").

The findings below are the ones the builder was handed after the Opus pass, grouped by room. The Opus review's own wording was not kept in the repo, so this file records each finding as it was fixed.

## The Brain

- **A day that holds only a zero counted as a logged day.** A habit open and not ticked, a study hour open and not sat, or a paper that closed unsat gave a value, so a student who logged nothing had "logged days" and the chains could rest on them. Fixed with `didSomething` and `loggedOn` in `metricRules.ts`; `brainRules` counts only days with a real log. `METRIC_VERSION` is now 2, and stored days of version 1 are rebuilt from the events.
- **A missed paper set C01 (the meal share).** `exams.missed` is now ignored by C01.
- **Lamp movement flipped on float arithmetic** (0.6 over 0.5 read "steady", 0.4 over 0.3 read "rising"). Movement is now worked out in whole thousandths.
- **A paused class got Brain rows and real zeros.** `brainDay.eligible` now returns false for a student of a paused class.
- **The rollup could read an event still being written.** `run` ignores events newer than 10 seconds. The stale rebuild keeps a paging token in `brainState` so rows that cannot be rebuilt now (a withdrawn student, a paused class) do not hold up the rest, and the nightly check reads 100 rows.

## Papers and exams

- **A window that ended while the class was paused counted as a miss.** It now closes as `excused`: no event, no mark, the teacher cannot mark it.
- **`papers.send` accepted a paused class and unsound windows.** It now refuses `class_paused` and `bad_window` (under a minute, over 14 days, or already over).
- **`markLong` added the same question's mark twice and marked excused attempts.** Both are refused.
- **A hint could name the answer** ("+", "option no. 2", "the answer's B", "(2)"). `hintGivesAnswer` covers these and does not fire on "First answer a simpler question".
- **The sweep could grow without bound in one minute.** It takes 25 at a time and schedules itself again. Lists are newest first.
- **`members.me` showed a paused student the consent step.** It now answers `removed` before any consent step.

## The blog

- **A student who withdrew still showed to classmates.** Standing is now checked for authors and commenters; they vanish and return on restore.
- **The download left out comments.** It is posts (cursor `p:`) then comments (cursor `c:`), and a post says `hadPhoto`.
- **No photo path existed.** Added `photoFileProblem`, `blog.photoUploadUrl` and the `by_photoId` index. A teacher sees the photo before classmates do; it is deleted with the post or the student.
- **The daily storage clean up would delete blog photos and profile pictures.** `reportCopy.sweep` leaves files held by either (`isHeldByPicture`).

## The study hour and the notice

- **Chat was kept for ever.** `retention.sweep` deletes chat after 30 days (a builder default for the owner to confirm).
- **The notice said nobody but the student could read their writing.** That was untrue once the rooms were built. The notice is now `house-v2` and says what really happens; everyone must agree again. The words remain drafts.

## What was done, and how it was checked

- Backend suite: 1108 of 1108 tests pass. `tsc` is clean. House lint has no errors, 73 of 73 house node tests pass, and `look:check` is ok.
- Tests added for each fix above (`examsPause.test.ts`, additions to `brainRules`, `brainRollup`, `metricRules`, `blogPhoto`, `classPause`), and the earlier failing tests were updated to the new rules.
- Browser proofs against the development deployment: `exams:check` 13 of 13 (the bell and the photo included), `brain:check` 8 of 8, `enter:check` 27 of 27, `consent:check` 12 of 12, `mood:check`, `habit:check`, `sleep:check`, `meals:check`, `modules:check` and `hour:check` all pass.
- Four proof scripts raced the Home card, which draws before its numbers arrive, and the staff lists, which are oldest first and now long. They were changed to wait for the real value and for the "Show more" button to return. No app code changed for these.
- Nothing was committed, pushed or deployed.

## Second review of the fix diff (2026-10-24, Claude Opus, read only)

It confirmed the paging, sweep, `markLong`, `send`, `members.me`, export, photo clean up, retention and lamp rounding fixes, and that no staff role can read the Brain. It raised four points.

**Fixed**
- A paused window with an attempt holding only blank answers (typed, then cleared) was recorded as a miss. The excused check now uses the same rule as the miss (`tally`), so it is excused. Test added in `examsPause.test.ts`.
- Erasing a student left classmates' comments on their posts pointing at a deleted post. The eraser now removes those comments first, in batches. Test added in `blogPhoto.test.ts`.

- A teacher's approval counted as the student doing something that day (owner chose, 2026-10-24: date it to when the student wrote it). `blog.review` now dates `blog.published` to the post's writing time (`publishedTime` in `blog.ts`), or to the approval when the post is older than the log accepts (7 days), so the approval is never refused for its age. Tests in `blogPhoto.test.ts`.

- The pause was judged by the class's state now, not on the day (owner chose, 2026-10-24: store the history). A new `classPauses` table keeps each pause with its start and end (`classes.pause` and `classes.resume` write it, `pauseHistory.pausedWithin` reads it). The Brain no longer skips a paused class's days, so events written during a pause are counted, and no real zero is written for any day a pause touched. An exam window is excused when the class was paused at the moment it ended, even if the sweep runs after the resume. Tests in `brainRollup.test.ts`, `examsPause.test.ts` and `classPause.test.ts`.

**Open**
- None from this review. The remaining open items are in the final report: layout shift on a few screens, and the builder defaults to confirm.
