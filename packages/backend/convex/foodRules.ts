// The pure rules of the food table and the meals room (spec house/0009, house/0010). No database and no clock, and no imports.
// The numbers of a food are per serving. A student may enter the numbers of their own custom dish (owner's answer, 2026-10-20); the catalog
// starts with names and groups only (`foodStarter.ts`), numbers wait for the licence checks, and no screen shows a calorie total.

export const FOOD_GROUPS = ["grain", "dal", "vegetable", "dairy", "fruit"] as const;
export type FoodGroup = (typeof FOOD_GROUPS)[number];
export const PROCESSING = ["home_cooked", "packaged", "fried"] as const;
export type Processing = (typeof PROCESSING)[number];
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];
export const MAX_NAME = 60;
export const MAX_SERVING = 40;
export const MAX_ALIASES = 5;
export const MAX_COUNT = 20;

export const isFoodGroup = (text: unknown): text is FoodGroup => typeof text === "string" && (FOOD_GROUPS as readonly string[]).includes(text);
export const isProcessing = (text: unknown): text is Processing => typeof text === "string" && (PROCESSING as readonly string[]).includes(text);
export const isMeal = (text: unknown): text is Meal => typeof text === "string" && (MEALS as readonly string[]).includes(text);

// A number per serving: finite, not negative, not absurdly large (per serving, 5000 kcal or 500 g is already wrong).
const numberOk = (value: unknown, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
export const nutritionProblem = (n: { energyKcal: unknown; carbsG: unknown; proteinG: unknown; fatG: unknown }): "bad_number" | null =>
  numberOk(n.energyKcal, 5000) && numberOk(n.carbsG, 500) && numberOk(n.proteinG, 500) && numberOk(n.fatG, 500) ? null : "bad_number";

// Text trimmed, non empty, within a length.
export function cleanName(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text.length > 0 && [...text].length <= max ? text : null;
}

// Search matches a name or an alias, ignoring case and the extra spaces around the text.
export function matches(text: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (q.length === 0) return true;
  return text.toLowerCase().replace(/\s+/g, " ").includes(q);
}

// Meal times: a meal is eaten at most 24 hours back and not in the future. Returns the problem code or null.
export const MAX_BACK_MS = 24 * 60 * 60 * 1000;
export function eatenAtProblem(eatenAt: number, now: number): "bad_time" | null {
  if (!Number.isFinite(eatenAt)) return "bad_time";
  if (eatenAt > now) return "bad_time";
  if (now - eatenAt > MAX_BACK_MS) return "bad_time";
  return null;
}

// Food groups counted for a day: how many items came from each group. Never a total of energy or protein.
export function groupCounts(items: readonly { group: string; count: number }[]): Record<FoodGroup, number> {
  const out: Record<FoodGroup, number> = { grain: 0, dal: 0, vegetable: 0, dairy: 0, fruit: 0 };
  for (const i of items) if (isFoodGroup(i.group)) out[i.group] += i.count;
  return out;
}
