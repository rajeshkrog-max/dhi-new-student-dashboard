// The study hour's event types (spec house/0015 and house/0018). `hour.present`: the whole minutes a student was present, and nothing else: no name,
// no mode and no message. One is written when a seat ends (the student leaves, the heartbeat stops, or the hour closes), and only for a stay of a
// minute or more. `hour.felt`: the answer to the after session card (how the student felt, their focus from 1 to 5, and the time and length bands of
// the stay), as fixed codes and one small number. A skipped card writes no event. `hour.felt` version 2 (house spec 0028) adds the subject the
// student tapped, if any.
import { defineEvent } from "../eventShapes";
import { FEELS, LENGTH_BANDS, SUBJECTS, TIME_BANDS } from "../sessionRules";

export const HOUR_EVENT_TYPES = [
  // Version 2 adds the minutes of the stay after 23:00 (the Brain's late night study time).
  defineEvent({ room: "hour", type: "hour.present", version: 2, payload: { minutes: { kind: "int", min: 1, max: 480 }, lateMinutes: { kind: "int", min: 0, max: 480, optional: true } } }),
  defineEvent({
    room: "hour",
    type: "hour.felt",
    version: 2,
    payload: {
      feel: { kind: "code", values: FEELS },
      focus: { kind: "int", min: 1, max: 5 },
      time: { kind: "code", values: TIME_BANDS },
      length: { kind: "code", values: LENGTH_BANDS },
      subject: { kind: "code", values: SUBJECTS, optional: true },
    },
  }),
];
