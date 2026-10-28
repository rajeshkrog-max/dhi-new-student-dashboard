// The desk's event type (spec house/0018, desk part). `desk.felt`: the answer to the after session card of a desk sitting of 10 minutes or more (how the
// student felt, their focus from 1 to 5, the time and length bands of the sitting, and the subject if they chose one), as fixed codes and one small
// number. A skipped card writes no event. The questions and answers themselves never reach the log. Version 2 (house spec 0028) adds the topic the
// student tapped, a topic of their class's papers, by its `paperTopics` id only.
import { defineEvent } from "../eventShapes";
import { FEELS, LENGTH_BANDS, SUBJECTS, TIME_BANDS } from "../sessionRules";

export const DESK_EVENT_TYPES = [
  // `desk.present`: the whole minutes of a desk sitting (first question to last), written by the system when the sitting ends, and nothing else: no
  // question, no answer, no subject. A sitting under a minute writes none.
  defineEvent({ room: "desk", type: "desk.present", version: 1, payload: { minutes: { kind: "int", min: 1, max: 480 } } }),
  // `desk.mode`: how many questions a finished sitting held and how many of them were an active learning kind (write, paper or mock), two counts and
  // nothing else, written by the system when the sitting ends (the Brain's A10 and A12).
  // Version 2 (house spec 0030) adds how many of the questions were a plain question (a doubt, A18's bottom part).
  defineEvent({ room: "desk", type: "desk.mode", version: 2, payload: { turns: { kind: "int", min: 1, max: 100 }, active: { kind: "int", min: 0, max: 100 }, doubts: { kind: "int", min: 0, max: 100, optional: true } } }),
  // `desk.resolved`: the student marked an answer as solving their doubt (A18). Carries nothing.
  defineEvent({ room: "desk", type: "desk.resolved", version: 1, payload: {} }),
  // `desk.answered`: one answer in the desk's practice, Fix or recall (house spec 0031): the topic by id, right or wrong, the mode, whether the question was
  // first seen 7 or more days before (A04), whether the student had it wrong before (A05), and the seconds.
  defineEvent({
    room: "desk",
    type: "desk.answered",
    version: 1,
    payload: {
      topic: { kind: "id" },
      right: { kind: "boolean" },
      mode: { kind: "code", values: ["practice", "fix", "recall"] },
      seen7: { kind: "boolean" },
      pastWrong: { kind: "boolean" },
      sec: { kind: "int", min: 0, max: 600, optional: true },
    },
  }),
  // `desk.mastered`: a topic was held for the first time (A09): mastery 0.85 or more on two answers at least three days apart. The topic by id.
  defineEvent({ room: "desk", type: "desk.mastered", version: 1, payload: { topic: { kind: "id" } } }),
  defineEvent({
    room: "desk",
    type: "desk.felt",
    version: 3,
    payload: {
      feel: { kind: "code", values: FEELS },
      focus: { kind: "int", min: 1, max: 5 },
      time: { kind: "code", values: TIME_BANDS },
      length: { kind: "code", values: LENGTH_BANDS },
      subject: { kind: "code", values: SUBJECTS, optional: true },
      topic: { kind: "id", optional: true },
      // Version 3 (house spec 0030): the whole minutes of the sitting, so a subject's share of desk time can be worked out (A11).
      minutes: { kind: "int", min: 0, max: 480, optional: true },
    },
  }),
];
