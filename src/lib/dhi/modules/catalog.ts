/**
 * House modules. Admin uploads the film. Students only watch.
 *
 * modules
 *   id, title, category, blurb, cover, src, minutes
 *   owner = house (never a student upload)
 *
 * module_progress
 *   student_id, module_id, watched_ratio, completed_at, score
 *   score is written once, when the film reaches the end.
 */

export type ModuleCategory = "Academic" | "Self help" | "Mental health";

export type HouseModule = {
  id: string;
  title: string;
  category: ModuleCategory;
  blurb: string;
  cover: string;
  src: string;
  minutes: string;
  score: number;
};

export const MODULES: HouseModule[] = [
  {
    id: "mod-leaf",
    title: "The leaf kitchen",
    category: "Academic",
    blurb: "Where sugar is cooked. Sit until the film closes.",
    cover: "/desk/leaf-kitchen.jpg",
    src: "/landing/day.mp4",
    minutes: "A short sitting",
    score: 10,
  },
  {
    id: "mod-hearth",
    title: "The cell’s hearth",
    category: "Academic",
    blurb: "ATP is the coin. Watch it once, whole.",
    cover: "/desk/cell-story.jpg",
    src: "/landing/night.mp4",
    minutes: "A short sitting",
    score: 10,
  },
  {
    id: "mod-breath",
    title: "One quiet breath",
    category: "Mental health",
    blurb: "Nothing to solve. Stay until the end.",
    cover: "/mood/thought.jpg",
    src: "/landing/night.mp4",
    minutes: "A short sitting",
    score: 10,
  },
  {
    id: "mod-plate",
    title: "A plate is a practice",
    category: "Self help",
    blurb: "Food, without a lecture. The film keeps the pace.",
    cover: "/meals/thali.jpg",
    src: "/landing/day.mp4",
    minutes: "A short sitting",
    score: 10,
  },
  {
    id: "mod-grove",
    title: "Five small lamps",
    category: "Self help",
    blurb: "A habit is a film you finish, not a list you start.",
    cover: "/habits/grove.jpg",
    src: "/landing/day.mp4",
    minutes: "A short sitting",
    score: 10,
  },
  {
    id: "mod-room",
    title: "When the day is heavy",
    category: "Mental health",
    blurb: "A room to sit in. No chat. No skip.",
    cover: "/mood/room.jpg",
    src: "/landing/night.mp4",
    minutes: "A short sitting",
    score: 10,
  },
];

export const MODULE_KEY = "dhi-modules-v1";

export type ModuleProgress = Record<string, { ratio: number; kept: boolean }>;

export function loadProgress(): ModuleProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MODULE_KEY);
    return raw ? (JSON.parse(raw) as ModuleProgress) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: ModuleProgress) {
  try {
    localStorage.setItem(MODULE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}
