/**
 * food_catalog          premade kitchen
 * custom_foods          student-written names (uttapam, aite…) pending_nutrition until DHI fills
 * meal_plates           student_id + logged_on + slot + eaten_at (time they sat to eat)
 * meal_items            snapshots; kcal nullable while pending
 * kitchen_memory        catalog id OR custom name + use_count
 *
 * We track WHEN they eat to see rhythm (late lunch, skipped breakfast).
 * Not a diagnosis. Pattern for the house and later reports.
 */

import { uid } from "@/lib/dhi/id";

export type Unit = "katori" | "roti" | "glass" | "handful" | "ladle" | "plate" | "piece";
export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export type Guna = "sattva" | "rajas" | "tamas";

export type KitchenItem = {
  id: string;
  name: string;
  unit: Unit;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  guna: Guna;
};

export type PlateItem = {
  id: string;
  foodId: string;
  name: string;
  unit: Unit;
  qty: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  guna: Guna;
  pending: boolean;
};

export type Plate = {
  items: PlateItem[];
  eatenAt: string | null;
};

export type DayPlates = Record<Slot, Plate>;

export type DraftLine = {
  foodId?: string;
  customName?: string;
  unit: Unit;
  qty: number;
};

export type MealStore = {
  studentId: string;
  days: Record<string, DayPlates>;
  memory: Record<string, number>;
  pendingLookup: { name: string; unit: Unit; at: string }[];
};

export const STUDENT_ID = "stu_suzzy_glass";
export const STORE_KEY = "dhi-meals-v3";

export const KITCHEN: KitchenItem[] = [
  { id: "roti", name: "Roti / chapati", unit: "roti", kcal: 70, carbs: 15, protein: 2.5, fat: 0.5, guna: "sattva" },
  { id: "rice", name: "Steamed rice", unit: "katori", kcal: 130, carbs: 28, protein: 2.5, fat: 0.2, guna: "sattva" },
  { id: "dal", name: "Dal tadka", unit: "katori", kcal: 120, carbs: 18, protein: 7, fat: 3, guna: "sattva" },
  { id: "sabzi", name: "Seasonal sabzi", unit: "katori", kcal: 90, carbs: 12, protein: 3, fat: 3.5, guna: "sattva" },
  { id: "curd", name: "Dahi", unit: "katori", kcal: 70, carbs: 5, protein: 4, fat: 3.5, guna: "sattva" },
  { id: "milk", name: "Milk", unit: "glass", kcal: 120, carbs: 10, protein: 6, fat: 6, guna: "sattva" },
  { id: "buttermilk", name: "Chaas", unit: "glass", kcal: 40, carbs: 4, protein: 2, fat: 1.5, guna: "sattva" },
  { id: "poha", name: "Poha", unit: "plate", kcal: 250, carbs: 42, protein: 5, fat: 7, guna: "rajas" },
  { id: "idli", name: "Idli", unit: "piece", kcal: 60, carbs: 12, protein: 2, fat: 0.2, guna: "sattva" },
  { id: "dosa", name: "Dosa", unit: "piece", kcal: 120, carbs: 18, protein: 3, fat: 4, guna: "rajas" },
  { id: "uttapam", name: "Uttapam", unit: "piece", kcal: 140, carbs: 20, protein: 4, fat: 4.5, guna: "rajas" },
  { id: "khichdi", name: "Khichdi", unit: "katori", kcal: 150, carbs: 24, protein: 5, fat: 3.5, guna: "sattva" },
  { id: "banana", name: "Kela", unit: "piece", kcal: 90, carbs: 23, protein: 1, fat: 0.3, guna: "sattva" },
  { id: "peanuts", name: "Moongphali", unit: "handful", kcal: 160, carbs: 5, protein: 7, fat: 14, guna: "rajas" },
  { id: "ghee-roti", name: "Ghee on roti", unit: "ladle", kcal: 45, carbs: 0, protein: 0, fat: 5, guna: "sattva" },
  { id: "aloo-paratha", name: "Aloo paratha", unit: "piece", kcal: 210, carbs: 28, protein: 5, fat: 9, guna: "rajas" },
  { id: "chai", name: "Chai with sugar", unit: "glass", kcal: 80, carbs: 12, protein: 2, fat: 2.5, guna: "rajas" },
  { id: "biscuits", name: "Marie biscuits", unit: "piece", kcal: 25, carbs: 4, protein: 0.4, fat: 0.8, guna: "tamas" },
  { id: "pakora", name: "Pakora", unit: "piece", kcal: 55, carbs: 5, protein: 1.5, fat: 3.5, guna: "tamas" },
  { id: "sambar", name: "Sambar", unit: "katori", kcal: 80, carbs: 12, protein: 4, fat: 2, guna: "sattva" },
  { id: "egg", name: "Anda (boiled)", unit: "piece", kcal: 78, carbs: 0.6, protein: 6.5, fat: 5.3, guna: "rajas" },
];

export const GOAL = { kcal: 2000, carbs: 260, protein: 55, fat: 55 };
export const UNITS: Unit[] = ["katori", "roti", "glass", "handful", "ladle", "plate", "piece"];
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const TIPS = [
  {
    id: "t1",
    title: "A thali is a full sentence",
    body: "Dal, grain, sabzi, dahi — four lamps on one plate. The mind stays longer in class when the plate is complete, not when it is expensive.",
    image: "/meals/thali.jpg",
  },
  {
    id: "t2",
    title: "Dahi after heat",
    body: "A katori of curd after a hot lunch cools the gut. Students who eat only dry roti often feel the afternoon slump first.",
    image: "/meals/dahi.jpg",
  },
  {
    id: "t3",
    title: "Fried is a guest, not a resident",
    body: "Pakora has a place on rain days. Daily oil sits heavy on Viveka — the recall lamp — by evening.",
    image: "/meals/plate.jpg",
  },
];

export function emptyPlate(): Plate {
  return { items: [], eatenAt: null };
}

export function emptyDay(): DayPlates {
  return { breakfast: emptyPlate(), lunch: emptyPlate(), dinner: emptyPlate(), snack: emptyPlate() };
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function clockNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function eatenStamp(timeHHmm: string) {
  return `${todayKey()}T${timeHHmm}:00`;
}

function snap(food: KitchenItem, qty: number): PlateItem {
  return {
    id: uid(),
    foodId: food.id,
    name: food.name,
    unit: food.unit,
    qty,
    kcal: food.kcal * qty,
    carbs: food.carbs * qty,
    protein: food.protein * qty,
    fat: food.fat * qty,
    guna: food.guna,
    pending: false,
  };
}

function snapCustom(name: string, unit: Unit, qty: number): PlateItem {
  const id = `custom:${name.trim().toLowerCase()}`;
  return {
    id: uid(),
    foodId: id,
    name: name.trim(),
    unit,
    qty,
    kcal: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
    guna: "sattva",
    pending: true,
  };
}

function atHour(key: string, hh: number, mm: number) {
  return `${key}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function seedPast(store: MealStore) {
  const roti = KITCHEN.find((k) => k.id === "roti")!;
  const dal = KITCHEN.find((k) => k.id === "dal")!;
  const rice = KITCHEN.find((k) => k.id === "rice")!;
  const poha = KITCHEN.find((k) => k.id === "poha")!;
  const milk = KITCHEN.find((k) => k.id === "milk")!;
  const sabzi = KITCHEN.find((k) => k.id === "sabzi")!;
  const curd = KITCHEN.find((k) => k.id === "curd")!;
  const khichdi = KITCHEN.find((k) => k.id === "khichdi")!;
  const days = [3, 2, 1].map((ago) => {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    return todayKey(d);
  });
  store.days[days[0]] = {
    ...emptyDay(),
    breakfast: { items: [snap(poha, 1), snap(milk, 1)], eatenAt: atHour(days[0], 8, 10) },
    lunch: { items: [snap(roti, 2), snap(dal, 1), snap(sabzi, 1)], eatenAt: atHour(days[0], 13, 25) },
  };
  store.days[days[1]] = {
    ...emptyDay(),
    lunch: { items: [snap(rice, 1), snap(dal, 1), snap(curd, 1)], eatenAt: atHour(days[1], 14, 5) },
    dinner: { items: [snap(roti, 2), snap(sabzi, 1)], eatenAt: atHour(days[1], 20, 40) },
  };
  store.days[days[2]] = {
    ...emptyDay(),
    breakfast: { items: [snap(milk, 1)], eatenAt: atHour(days[2], 8, 40) },
    lunch: { items: [snap(roti, 3), snap(dal, 1), snap(rice, 1), snap(sabzi, 1)], eatenAt: atHour(days[2], 13, 10) },
    dinner: { items: [snap(khichdi, 1)], eatenAt: atHour(days[2], 20, 15) },
  };
}

export function loadStore(): MealStore {
  const blank: MealStore = { studentId: STUDENT_ID, days: {}, memory: {}, pendingLookup: [] };
  if (typeof window === "undefined") return blank;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MealStore;
  } catch {
    /* ignore */
  }
  seedPast(blank);
  localStorage.setItem(STORE_KEY, JSON.stringify(blank));
  return blank;
}

export function saveStore(store: MealStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function dayOf(store: MealStore, key = todayKey()): DayPlates {
  return store.days[key] ?? emptyDay();
}

export function itemsOf(day: DayPlates): PlateItem[] {
  return SLOTS.flatMap((s) => day[s].items);
}

export function sumItems(items: PlateItem[]) {
  return items.reduce(
    (acc, i) => {
      acc.kcal += i.kcal;
      acc.carbs += i.carbs;
      acc.protein += i.protein;
      acc.fat += i.fat;
      acc.guna[i.guna] += i.qty;
      acc.pending += i.pending ? 1 : 0;
      return acc;
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0, pending: 0, guna: { sattva: 0, rajas: 0, tamas: 0 } },
  );
}

export function confirmPlate(store: MealStore, slot: Slot, draft: DraftLine[], eatenAt: string) {
  const key = todayKey();
  const memory = { ...store.memory };
  const pendingLookup = [...store.pendingLookup];
  const items = draft
    .filter((d) => d.qty > 0)
    .map((d) => {
      if (d.customName) {
        const item = snapCustom(d.customName, d.unit, d.qty);
        memory[item.foodId] = (memory[item.foodId] ?? 0) + d.qty;
        pendingLookup.push({ name: item.name, unit: item.unit, at: new Date().toISOString() });
        return item;
      }
      const food = KITCHEN.find((k) => k.id === d.foodId);
      if (!food) return null;
      memory[food.id] = (memory[food.id] ?? 0) + d.qty;
      return snap(food, d.qty);
    })
    .filter((x): x is PlateItem => Boolean(x));
  const plate: Plate = { items, eatenAt };
  const day: DayPlates = { ...emptyDay(), ...(store.days[key] ?? emptyDay()), [slot]: plate };
  const next: MealStore = { ...store, memory, pendingLookup, days: { ...store.days, [key]: day } };
  saveStore(next);
  return next;
}

export function clearSlot(store: MealStore, slot: Slot) {
  const key = todayKey();
  const day: DayPlates = { ...emptyDay(), ...(store.days[key] ?? emptyDay()), [slot]: emptyPlate() };
  const next: MealStore = { ...store, days: { ...store.days, [key]: day } };
  saveStore(next);
  return next;
}

export function weekMatrix(store: MealStore) {
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const s = sumItems(itemsOf(dayOf(store, key)));
    rows.push({
      key,
      label: String(d.getDate()),
      kcal: Math.round(s.kcal),
      carbs: Math.round(s.carbs),
      protein: Math.round(s.protein),
      fat: Math.round(s.fat),
    });
  }
  return rows;
}

export function weekTop(store: MealStore) {
  const tally: Record<string, { name: string; kcal: number; qty: number; pending: boolean }> = {};
  for (const row of weekMatrix(store)) {
    for (const item of itemsOf(dayOf(store, row.key))) {
      const t = tally[item.foodId] ?? { name: item.name, kcal: 0, qty: 0, pending: item.pending };
      t.kcal += item.kcal;
      t.qty += item.qty;
      tally[item.foodId] = t;
    }
  }
  return Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 4);
}

export function weekRhythm(store: MealStore) {
  const buckets: Record<Slot, number[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = dayOf(store, todayKey(d));
    for (const slot of SLOTS) {
      const at = day[slot].eatenAt;
      if (!at) continue;
      const part = at.slice(11, 16);
      const [h, m] = part.split(":").map(Number);
      buckets[slot].push(h * 60 + m);
    }
  }
  const pretty = (mins: number[]) => {
    if (!mins.length) return null;
    const mid = [...mins].sort((a, b) => a - b)[Math.floor(mins.length / 2)];
    return `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
  };
  return {
    breakfast: pretty(buckets.breakfast),
    lunch: pretty(buckets.lunch),
    dinner: pretty(buckets.dinner),
    snack: pretty(buckets.snack),
  };
}

export function formatClock(iso: string | null) {
  if (!iso) return null;
  const t = iso.slice(11, 16);
  return t || null;
}

export function mindLine(g: { sattva: number; rajas: number; tamas: number }) {
  const t = g.sattva + g.rajas + g.tamas || 1;
  if (g.tamas / t > 0.3) return "The plate is heavy. A walk and water will lift the evening sitting.";
  if (g.sattva / t >= 0.5) return "The plate is light and complete. Body and mind can sit together.";
  return "The plate is busy. Fine for a long day — keep dinner quieter.";
}
