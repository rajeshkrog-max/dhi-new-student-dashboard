// The sleep room's event type (spec house/0008). The payload is two whole numbers and nothing else: the student's times stay in `sleepNights`.
// `bedMin` is minutes after 12:00 noon India time (0 to 1439), and the wake time is (bedMin + lengthMin) mod 1440 on the same scale. Any change
// of that scale is a new event version (version 2).
import { defineEvent } from "../eventShapes";

export const SLEEP_EVENT_TYPES = [
  defineEvent({
    room: "sleep",
    type: "sleep.logged",
    version: 1,
    payload: { bedMin: { kind: "int", min: 0, max: 1439 }, lengthMin: { kind: "int", min: 60, max: 960 } },
  }),
];
