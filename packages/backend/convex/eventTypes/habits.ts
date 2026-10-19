// The habits room's event type (spec house/0007). The payload is the kind of habit and nothing else: the student's own title stays in `habitPlans`.
// An undo is a void of this type, so it carries no payload.
import { defineEvent } from "../eventShapes";
import { HABIT_KINDS } from "../habitCodes";

export const HABIT_EVENT_TYPES = [defineEvent({ room: "habits", type: "habits.ticked", version: 1, payload: { habit: { kind: "code", values: HABIT_KINDS } } })];
