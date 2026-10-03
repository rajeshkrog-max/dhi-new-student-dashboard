/**
 * mood_logs     student_id + logged_on unique, mood, note, dhi_thought snapshot
 * counsel_help  student_id, message, slot_id, created_at  — DHI never sees recordings
 *
 * Client key: dhi-mood-v1
 */

import { uid } from "@/lib/dhi/id";

export const STORE_KEY = "dhi-mood-v1";
export const YEAR = 2026;
export const STUDENT_ID = "stu_suzzy_glass";
export const COUNSELOR = "Asha Rao";

export type MoodKey =
  | "best"
  | "happy"
  | "motivated"
  | "determined"
  | "content"
  | "tired"
  | "stressed"
  | "anxious"
  | "sad"
  | "heavy";

export const MOODS: { key: MoodKey; label: string; color: string; glyph: string }[] = [
  { key: "best", label: "Best day", color: "#1e4d3a", glyph: "🪔" },
  { key: "happy", label: "Happy", color: "#3d7a4a", glyph: "🌿" },
  { key: "motivated", label: "Motivated", color: "#6fae7a", glyph: "🌅" },
  { key: "determined", label: "Determined", color: "#c6a24a", glyph: "🕯️" },
  { key: "content", label: "Content", color: "#c5d9c4", glyph: "🍃" },
  { key: "tired", label: "Tired", color: "#c4b49a", glyph: "🌒" },
  { key: "stressed", label: "Stressed", color: "#c47a4a", glyph: "🌊" },
  { key: "anxious", label: "Anxious", color: "#d98980", glyph: "🌬️" },
  { key: "sad", label: "Sad", color: "#6a7a78", glyph: "🌧️" },
  { key: "heavy", label: "Heavy", color: "#3d4450", glyph: "🌑" },
];

export const THOUGHTS: Record<MoodKey, string[]> = {
  best: [
    "A lamp that burns this bright still needs oil tomorrow. Keep one quiet hour.",
    "Joy is a guest. Offer it a seat, then write one line so it can visit again.",
  ],
  happy: [
    "Happiness that can name itself is already wisdom. What fed it today?",
    "The house is light. Share one small kindness so the lamp does not stay only yours.",
  ],
  motivated: [
    "Fire is useful when it has a hearth. Pick one sitting, not ten.",
    "Motivation is a morning. Guard it from the first scroll.",
  ],
  determined: [
    "Determination is a spine, not a shout. One honest page is enough.",
    "The mountain does not hurry. Keep the hour you named.",
  ],
  content: [
    "Content is a quiet table. Do not add a feast just because the day was kind.",
    "Enough is a rare colour. Sit with it.",
  ],
  tired: [
    "Tired is a request, not a failure. Sleep is also a sitting.",
    "Put the bag down. The house will still be here at dawn.",
  ],
  stressed: [
    "Stress is a crowd in the chest. Name one thing you can put outside the door.",
    "Breathe once as if the paper is not watching.",
  ],
  anxious: [
    "Anxiety writes tomorrow too early. Come back to this hour.",
    "You do not have to solve the night. You only have to stay.",
  ],
  sad: [
    "Sadness is weather, not a verdict. Let it pass through the house without being locked in.",
    "A low lamp still lights the path. You do not have to shine to be here.",
  ],
  heavy: [
    "Heavy days are for a human sitting, not for carrying alone. Ask. The house has a counselor’s door.",
    "You do not have to explain the whole night. One sentence is enough to open the door.",
  ],
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type MoodDay = {
  date: string;
  mood: MoodKey;
  note: string;
  thought: string;
};

export type HelpAsk = {
  id: string;
  message: string;
  slotId: string | null;
  createdAt: string;
};

export type MoodStore = {
  studentId: string;
  year: number;
  days: Record<string, MoodDay>;
  help: HelpAsk[];
};

export type CounselSlot = {
  id: string;
  date: string;
  start: string;
  status: "open" | "booked";
};

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function moodOf(key: MoodKey) {
  return MOODS.find((m) => m.key === key)!;
}

export function thoughtFor(mood: MoodKey, note: string) {
  const bank = THOUGHTS[mood];
  const i = note.length % bank.length;
  return bank[i];
}

function seed(): MoodStore {
  const keys: MoodKey[] = ["happy", "motivated", "determined", "content", "tired", "stressed", "anxious", "sad", "happy", "motivated", "best", "content", "determined", "happy", "motivated", "stressed"];
  const days: Record<string, MoodDay> = {};
  keys.forEach((mood, i) => {
    const date = `2026-09-${String(i + 1).padStart(2, "0")}`;
    if (date >= todayKey()) return;
    days[date] = { date, mood, note: "", thought: thoughtFor(mood, date) };
  });
  return { studentId: STUDENT_ID, year: YEAR, days, help: [] };
}

export function loadMood(): MoodStore {
  if (typeof window === "undefined") return { studentId: STUDENT_ID, year: YEAR, days: {}, help: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MoodStore;
  } catch {
    /* ignore */
  }
  const s = seed();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}

function saveMood(store: MoodStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function logDay(store: MoodStore, date: string, mood: MoodKey, note: string): MoodStore {
  const next: MoodStore = {
    ...store,
    days: {
      ...store.days,
      [date]: { date, mood, note: note.trim(), thought: thoughtFor(mood, note) },
    },
  };
  saveMood(next);
  return next;
}

export function rangeCounts(store: MoodStore, from: Date, to: Date) {
  const counts = Object.fromEntries(MOODS.map((m) => [m.key, 0])) as Record<MoodKey, number>;
  let n = 0;
  const a = todayKey(from);
  const b = todayKey(to);
  for (const [date, day] of Object.entries(store.days)) {
    if (date < a || date > b) continue;
    counts[day.mood] += 1;
    n += 1;
  }
  return { counts, n };
}

export function openSlots(): CounselSlot[] {
  const t = new Date();
  const days = [1, 2, 3].map((n) => {
    const d = new Date(t);
    d.setDate(t.getDate() + n);
    return todayKey(d);
  });
  const hours = ["16:00", "17:30", "19:00"];
  const slots: CounselSlot[] = [];
  days.forEach((date, di) => {
    hours.forEach((start, hi) => {
      slots.push({
        id: `slot_${date}_${start}`,
        date,
        start,
        status: di === 0 && hi === 1 ? "booked" : "open",
      });
    });
  });
  return slots;
}

export function sendHelp(store: MoodStore, message: string, slotId: string | null): MoodStore {
  const next: MoodStore = {
    ...store,
    help: [...store.help, { id: uid(), message: message.trim(), slotId, createdAt: new Date().toISOString() }],
  };
  saveMood(next);
  return next;
}
