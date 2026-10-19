/**
 * The shapes the habits screen works with (spec house/0007). The server tables are `habitPlans` and `habitChecks` (packages/backend/convex/schema.ts);
 * these types are the screen's view of them. A miss is a day in the window with no tick. It is not stored, and history is never rewritten.
 */

export const MAX_HABITS = 5;

export const PALETTE = [
  { id: "green", name: "Green", hex: "#2f6b3a", feel: "growth" },
  { id: "gold", name: "Gold", hex: "#e8c36a", feel: "progress" },
  { id: "orange", name: "Orange", hex: "#e08a3d", feel: "energy" },
  { id: "blue", name: "Blue", hex: "#3d6ea8", feel: "calm" },
  { id: "purple", name: "Purple", hex: "#6b5b95", feel: "focus" },
  { id: "pink", name: "Pink", hex: "#d9899c", feel: "kindness" },
  { id: "teal", name: "Teal", hex: "#3d8a7a", feel: "balance" },
  { id: "red", name: "Red", hex: "#c45c4a", feel: "drive" },
] as const;

export type PaletteId = (typeof PALETTE)[number]["id"];

export type HabitPlan = {
  id: string;
  studentId: string;
  catalogId: string | null;
  title: string;
  color: string;
  startOn: string;
  endOn: string;
  createdAt: string;
};

export type HabitCheck = {
  id: string;
  planId: string;
  studentId: string;
  loggedOn: string;
  lit: boolean;
  createdAt: string;
};

export type HabitStore = {
  studentId: string;
  plans: HabitPlan[];
  checks: HabitCheck[];
};

export const MILESTONES = [3, 7, 14, 21, 30];
