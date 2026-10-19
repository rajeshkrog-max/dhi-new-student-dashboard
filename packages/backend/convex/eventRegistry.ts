// The one static registry of event types (spec house/0004, AC-8). Every room's types are imported here and listed once. A type that is not
// listed is refused with `unknown_type`, so a room cannot start writing events by only defining them. Each room row adds its file to this list
// when the room is built, and sets the room's exporter and eraser beside it (spec house/0005).
import { TEST_EVENT_TYPES } from "./eventTypes/test";
import type { EventDef } from "./eventShapes";

export const EVENT_DEFS: readonly EventDef[] = [...TEST_EVENT_TYPES];

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
