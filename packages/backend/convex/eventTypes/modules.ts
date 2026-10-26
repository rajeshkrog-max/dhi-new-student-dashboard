// The modules room's event type (spec house/0013). The payload is the film's category and nothing else: the title and the student's progress stay
// in `films` and `filmProgress`. One event is written, the first time a film is watched to its end (a replay writes none).
import { defineEvent } from "../eventShapes";
import { CATEGORIES } from "../moduleRules";

export const MODULES_EVENT_TYPES = [
  defineEvent({ room: "modules", type: "modules.kept", version: 1, payload: { category: { kind: "code", values: CATEGORIES } } }),
];
