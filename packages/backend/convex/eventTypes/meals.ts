// The meals room's event type (spec house/0010). The payload is the meal, the food group and how the food is made (home cooked, packaged or fried;
// added in version 2 for the Brain, spec house/0019), all fixed codes. An event of version 1 has no processing tag, and the Brain leaves it out. The dish's name stays in `foods`
// and `mealPlates`. A removed plate is a void of this event (the same as a habit's untick), so the day reads as not logged for it.
import { defineEvent } from "../eventShapes";
import { FOOD_GROUPS, MEALS, PROCESSING } from "../foodRules";

export const MEALS_EVENT_TYPES = [
  defineEvent({
    room: "meals",
    type: "meals.logged",
    version: 2,
    payload: { meal: { kind: "code", values: MEALS }, group: { kind: "code", values: FOOD_GROUPS }, processing: { kind: "code", values: PROCESSING } },
  }),
];
