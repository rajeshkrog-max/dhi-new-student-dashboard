// The exams room's event types (spec house/0012; the Brain reads them, scope row 17). `exams.submitted`: one finished sitting, as small counts and a
// flag, and never an answer or a mark: how many multiple choice questions were tried and how many were right, how many long answers have writing,
// how many hints were opened, and whether the window closed before the student pressed Submit. `exams.missed`: the window closed with nothing
// answered. One of the two is written for each attempt, at the time the sitting ended (a closed window counts from its due time).
// Version 2 (house spec 0028) adds, for up to 10 topics of the paper, the topic's id with the multiple choice answers tried and right on it, as three
// lists in the same order. No topic words: only the id of its `paperTopics` row.
import { defineEvent } from "../eventShapes";

export const EXAMS_EVENT_TYPES = [
  defineEvent({
    room: "exams",
    type: "exams.submitted",
    version: 3,
    payload: {
      auto: { kind: "boolean" },
      mcqTried: { kind: "int", min: 0, max: 50 },
      mcqRight: { kind: "int", min: 0, max: 50 },
      longDone: { kind: "int", min: 0, max: 50 },
      hints: { kind: "int", min: 0, max: 50 },
      topics: { kind: "list", of: { kind: "id" }, max: 10, optional: true },
      topicTried: { kind: "list", of: { kind: "int", min: 0, max: 50 }, max: 10, optional: true },
      topicRight: { kind: "list", of: { kind: "int", min: 0, max: 50 }, max: 10, optional: true },
      // Version 3 (house spec 0030): why the wrong multiple choice answers went wrong (A07), the seconds of the timed answers and how many (A08), and the
      // gain in points over the earlier paper this one repeats (A20), all counts.
      wrongMisread: { kind: "int", min: 0, max: 50, optional: true },
      wrongCareless: { kind: "int", min: 0, max: 50, optional: true },
      wrongConcept: { kind: "int", min: 0, max: 50, optional: true },
      paceSec: { kind: "int", min: 0, max: 30000, optional: true },
      paceN: { kind: "int", min: 0, max: 50, optional: true },
      gain: { kind: "int", min: -100, max: 100, optional: true },
    },
  }),
  // `exams.remarked`: a teacher confirmed a mark with the rubric on written answers (A03; house spec 0030): the sum of the scores given (each 0 to 4) and how
  // many were given. Written by the teacher, so it is not the student's own log.
  defineEvent({ room: "exams", type: "exams.remarked", version: 1, payload: { rubricSum: { kind: "int", min: 0, max: 600 }, rubricN: { kind: "int", min: 1, max: 150 } } }),
  defineEvent({ room: "exams", type: "exams.missed", version: 1, payload: {} }),
];
