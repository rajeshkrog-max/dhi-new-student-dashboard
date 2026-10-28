# 0028. Topic and subject tags, and the connections P4 and P6

**Date**: 2026-10-28
**Status**: In Progress

## Summary

Papers, the desk and the study hour now share one list of subjects, and papers and the desk share the topics of a class's papers. A teacher picks the subject of each paper question from the fixed list and writes the topic in their own words. After a desk sitting the student may tap a subject and then one of the topics sent to their class. After a study hour stay they may tap a subject. With these tags the Brain tests the last two pairs of the Master Spec's connections engine (spec 0023): P4, a desk sitting on a topic and the next day's paper answers on that topic, and P6, how often the sessions of one subject left the student drained. Like the rest of the Brain, both are the student's alone.

## Requirements

**Owner answers (2026-10-28)**:
1. Who tags? **Teachers and students.** Teachers tag each paper question (the subject from the fixed list, the topic in their words). The student taps an optional subject on the desk and study hour cards, and on the desk card an optional topic from the papers sent to their class. (Offered: a topic list written by DHI's team; the desk model guessing.)
2. Which pairs? **Both P4 and P6.**

**Defaults the builder chose (say if any should change)**: the six subjects stay the desk's list (maths, science, english, social, hindi, other); a teacher's usual name is accepted ("Maths", "Social studies") and stored as the code; topics with the same words in any case or spacing are one topic of an institute; a card offers at most 12 topics, newest sent first; the study hour card asks for a subject only (P4 is about the desk); a paper's event names at most 10 topics; P4 compares topic days (one sample for each topic on a paper day), P6 compares sessions; for P6 each subject is tested against all the others and the strongest one stands for the pair with its p value multiplied by the number of subjects tested (Bonferroni), so trying six subjects never makes a coincidence easier to show; P4 shows in either direction.

**Acceptance criteria**:
- **AC-1**: A paper question's subject is one of the fixed list, as its code or its usual name; anything else is refused as `bad_question`. The builder offers a pick of the six, and a sitting and the school report show the subject in words (an older free text subject shows as it was).
- **AC-2**: The first question of an institute with a subject and topic makes one `paperTopics` row; the same words in any case or spacing find it again. Another subject or institute is another topic.
- **AC-3**: Sending a paper notes its topics for the class (`classTopics`). `topics.forCard` (students only) returns the topics of one subject sent to the student's own class, newest first, at most 12. A draft never sent offers nothing; staff are refused.
- **AC-4**: The desk card keeps a topic only with its subject and only if that topic of that subject was sent to the student's class (`bad_topic` otherwise). `desk.felt` (version 2) names the topic by its row id, never its words.
- **AC-5**: The study hour card keeps an optional subject from the list (`bad_subject` otherwise); `hour.felt` version 2 carries it.
- **AC-6**: `exams.submitted` version 2 names up to 10 topics of the paper by id, with the multiple choice answers tried and right on each.
- **AC-7**: The Brain keeps a day's tagged values beside its measures (`brainDays.tags`, `metricRules.tagsOfDay`): `p:<topic>` right of tried, `d:<topic>` a desk sitting, `s:<subject>` drained of the sessions. No lamp, chain, coverage line or parent page reads them. `METRIC_VERSION` is 8, so stored days are rebuilt with them. They go in the student's download with the day and are erased with it.
- **AC-8**: P4 (`topic_desk_papers`): each finished paper day's share right on a topic, group A when the day before held a desk sitting tagged with that topic, group B otherwise; 14 or more topic days in each group. P6 (`subject_feeling`): every tagged session as 1 when drained; one subject against the others, 10 or more sessions in each; the server sends the subject's code. Both use the bootstrap interval and the Benjamini Hochberg step of spec 0023 over the same six pairs. Today is never read.
- **AC-9**: The Progress page words are drafts (`BRAIN_WORDS_APPROVED` is false) in English and Hinglish, say "tend to go together", name the days or sessions behind them, name the subject in words, and pass the Brain's copy lint. A connection can be hidden for 30 days like the others.
- **AC-10**: No staff function reads a student's tap, a tagged value or a connection. A topic's words live only in `paperTopics`, the teachers' material.
- **AC-11**: The desk room draws once with its card, so the desk does not jump when a card is waiting (found by the sweep; the card loaded late before this spec too). Every changed screen passes axe at 1280 and 360 px.

## Tests

`topics.test.ts` (AC-1 to AC-7), `connectionRules.test.ts` (P4 and P6: the groups, the minimums, the correction for the subjects tried, today ignored), `brain.test.ts` (the tagged seed through the report, staff refused), `exams.test.ts` (the event's topic lists), `brain-words.test.ts` (the copy rules for both pairs and every subject in both languages). Browser: `pnpm topics:check` (the desk card's topic pick and the stored event), a new step in `brain:check` (seed `tagged`), the subject tap in `hour:check`, the subject pick in `exams:check`. The sweep has the scenes `dhi-card`, `hour-card` and `progress-connections` (seed `sweep`).

## Still open

- A topic list written by DHI's team, if the teachers' own words turn out too varied to match across papers.
- The words are drafts until the owner approves them.
