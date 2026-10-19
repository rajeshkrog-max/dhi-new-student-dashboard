// The fixed lists and limits of the habits room (spec house/0007) with no imports at all, so the screen, the server and the node tests can all read
// them. Exported from the package as `@dhi/backend/habitCodes`. The checks that need the day rule (the window) are in habitRules.ts.

// The six suggested habits of the room plus `custom` (a name the student wrote). The event carries only this code, never the student's title.
export const HABIT_KINDS = ["water", "sleep", "page", "walk", "phone", "sit", "custom"] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];
export const isHabitKind = (text: unknown): text is HabitKind => typeof text === "string" && (HABIT_KINDS as readonly string[]).includes(text);

// The eight colours a student can pick.
export const HABIT_COLORS = ["#2f6b3a", "#e8c36a", "#e08a3d", "#3d6ea8", "#6b5b95", "#d9899c", "#3d8a7a", "#c45c4a"] as const;
export const isHabitColor = (text: unknown): boolean => typeof text === "string" && (HABIT_COLORS as readonly string[]).includes(text);

export const MAX_OPEN_HABITS = 5;
export const MAX_TITLE = 40;
// A habit may start today or up to this many days ahead, and run at most this many days counting both ends.
export const START_AHEAD_DAYS = 14;
export const MAX_WINDOW_DAYS = 90;
// After the first tick of a day a habit may be flipped (undone or ticked again) at most this many more times.
export const MAX_FLIPS = 6;
export const ADDS_PER_DAY = 10;
export const FINISHED_SHOWN = 25;
export const EXPORT_HABITS_PAGE = 25;
