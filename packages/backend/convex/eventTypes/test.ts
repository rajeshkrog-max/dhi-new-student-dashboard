// The log's own test types (spec house/0004: "tests use a test type"). Room `test` holds no student's feeling or study: it exists so the log can
// be tried without a real room, in the suites and in the development proof (eventProof.ts). Every real room adds its own file beside this one
// and lists it in eventRegistry.ts when that room is built.
import { defineEvent } from "../eventShapes";

export const TEST_EVENT_TYPES = [
  defineEvent({
    room: "test",
    type: "test.ping",
    version: 2,
    payload: {
      count: { kind: "int", min: 0, max: 1000 },
      level: { kind: "code", values: ["low", "mid", "high"], optional: true },
      flag: { kind: "boolean", optional: true },
      ref: { kind: "id", optional: true },
      score: { kind: "number", min: 0, max: 100, optional: true },
      picks: { kind: "list", of: { kind: "int", min: 0, max: 99 }, max: 10, optional: true },
      extra: { kind: "group", fields: { a: { kind: "int", optional: true }, b: { kind: "code", values: ["x", "y"], optional: true } }, optional: true },
    },
  }),
  defineEvent({ room: "test", type: "test.pong", version: 1, payload: { count: { kind: "int", min: 0, max: 1000 } } }),
];
