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
    version: 2,
    payload: {
      auto: { kind: "boolean" },
      mcqTried: { kind: "int", min: 0, max: 50 },
      mcqRight: { kind: "int", min: 0, max: 50 },
      longDone: { kind: "int", min: 0, max: 50 },
      hints: { kind: "int", min: 0, max: 50 },
      topics: { kind: "list", of: { kind: "id" }, max: 10, optional: true },
      topicTried: { kind: "list", of: { kind: "int", min: 0, max: 50 }, max: 10, optional: true },
      topicRight: { kind: "list", of: { kind: "int", min: 0, max: 50 }, max: 10, optional: true },
    },
  }),
  defineEvent({ room: "exams", type: "exams.missed", version: 1, payload: {} }),
];
