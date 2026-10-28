// The modules room's event type (spec house/0013). The payload is the film's category and nothing else: the title and the student's progress stay
// in `films` and `filmProgress`. One event is written, the first time a film is watched to its end (a replay writes none).
import { defineEvent } from "../eventShapes";
import { CATEGORIES } from "../moduleRules";

export const MODULES_EVENT_TYPES = [
  defineEvent({ room: "modules", type: "modules.kept", version: 1, payload: { category: { kind: "code", values: CATEGORIES } } }),
  // `modules.checked`: the student answered an academic film's two checks, once (A16; house spec 0030): right of asked, and the topic of their own
  // institute the film is about, by its id, when there is one (A17).
  defineEvent({ room: "modules", type: "modules.checked", version: 1, payload: { right: { kind: "int", min: 0, max: 2 }, asked: { kind: "int", min: 1, max: 2 }, topic: { kind: "id", optional: true } } }),
];
