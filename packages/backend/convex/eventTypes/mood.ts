// The mood room's event type (spec house/0006). The payload is the mood code and nothing else: the student's own words stay in `moodDays`.
import { defineEvent } from "../eventShapes";
import { MOOD_CODES } from "../moodRules";

export const MOOD_EVENT_TYPES = [defineEvent({ room: "mood", type: "mood.logged", version: 1, payload: { mood: { kind: "code", values: MOOD_CODES } } })];
