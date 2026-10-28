// Counseling's event type (house spec 0030; the Master Spec's E17, asked for help). `counsel.asked`: the student booked a counselor's time. It carries
// nothing: no counselor, no time, no note. Only the student's own Brain reads it, as a count that is never a trend or a score; no staff function reads it.
import { defineEvent } from "../eventShapes";

export const COUNSEL_EVENT_TYPES = [defineEvent({ room: "counsel", type: "counsel.asked", version: 1, payload: {} })];
