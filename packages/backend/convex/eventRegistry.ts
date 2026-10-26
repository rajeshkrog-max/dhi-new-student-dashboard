// The one static registry of event types (spec house/0004, AC-8). Every room's types are imported here and listed once. A type that is not
// listed is refused with `unknown_type`, so a room cannot start writing events by only defining them. Each room row adds its file to this list
// when the room is built, and sets the room's exporter and eraser beside it (spec house/0005).
import { HABIT_EVENT_TYPES } from "./eventTypes/habits";
import { MOOD_EVENT_TYPES } from "./eventTypes/mood";
import { SLEEP_EVENT_TYPES } from "./eventTypes/sleep";
import { MEALS_EVENT_TYPES } from "./eventTypes/meals";
import { MODULES_EVENT_TYPES } from "./eventTypes/modules";
import { HOUR_EVENT_TYPES } from "./eventTypes/hour";
import { DESK_EVENT_TYPES } from "./eventTypes/desk";
import { EXAMS_EVENT_TYPES } from "./eventTypes/exams";
import { BLOG_EVENT_TYPES } from "./eventTypes/blog";
import { TEST_EVENT_TYPES } from "./eventTypes/test";
import type { EventDef } from "./eventShapes";

export const EVENT_DEFS: readonly EventDef[] = [...TEST_EVENT_TYPES, ...MOOD_EVENT_TYPES, ...HABIT_EVENT_TYPES, ...SLEEP_EVENT_TYPES, ...MEALS_EVENT_TYPES, ...MODULES_EVENT_TYPES, ...HOUR_EVENT_TYPES, ...EXAMS_EVENT_TYPES, ...BLOG_EVENT_TYPES, ...DESK_EVENT_TYPES];

const BY_TYPE = new Map<string, EventDef>();
for (const def of EVENT_DEFS) {
  if (BY_TYPE.has(def.type)) throw new Error(`event type listed twice: ${def.type}`);
  BY_TYPE.set(def.type, def);
}

// The registered entry for a type of a room, or null.
export function eventDef(room: string, type: string): EventDef | null {
  const def = BY_TYPE.get(type);
  return def && def.room === room ? def : null;
}
