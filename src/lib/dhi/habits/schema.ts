/**
 * habit_plans
 *   id, student_id, catalog_id, title, color (hex), start_on, end_on, created_at
 *   max 5 open plans per student
 *
 * habit_checks
 *   id, plan_id, student_id, logged_on, done boolean, created_at
 *   UNIQUE (plan_id, logged_on)
 *
 * Miss = day in window with no check. Not stored. Never rewrite history.
 * Client key: dhi-habits-v2
 */

export const STUDENT_ID = "stu_suzzy_glass";
export const STORE_KEY = "dhi-habits-v2";
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

export function emptyHabitStore(): HabitStore {
  return { studentId: STUDENT_ID, plans: [], checks: [] };
}

export const MILESTONES = [3, 7, 14, 21, 30];
