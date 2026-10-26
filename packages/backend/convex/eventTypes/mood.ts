// The mood room's event type (spec house/0006). The payload is the mood code and, from version 2, the number of words in the note (a count, for the Brain's
// note days): the student's own words stay in `moodDays`.
import { defineEvent } from "../eventShapes";
import { MOOD_CODES } from "../moodRules";

export const MOOD_EVENT_TYPES = [defineEvent({ room: "mood", type: "mood.logged", version: 2, payload: { mood: { kind: "code", values: MOOD_CODES }, noteWords: { kind: "int", min: 0, max: 250, optional: true } } })];
