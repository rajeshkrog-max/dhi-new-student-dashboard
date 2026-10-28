// The meals room's small rules (the house mockup's plate, rhythm and kitchen lamp), worked out from the student's own plates. They count food groups
// and times only: no calorie total, no target, and no word that calls a food good or bad (house specs 0009 and 0010, owner 2026-10-28).

export const GROUPS = ["grain", "dal", "vegetable", "dairy", "fruit"] as const;
export type Group = (typeof GROUPS)[number];
export type Groups = Record<Group, number>;

export const GROUP_WORDS: Record<Group, string> = {
  grain: "Grain",
  dal: "Dal or protein",
  vegetable: "Vegetable",
  dairy: "Dairy",
  fruit: "Fruit",
};

type Plate = { meal: string; group: string; count: number; foodName: string; eatenAt: number };

const minutesOf = (ms: number) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
};

export const clockOf = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

// The usual time of one meal over the plates given: the middle time of the days it was eaten (one time a day, the first plate of that meal), so one
// late night does not move it. Null when the meal was not logged.
export function usualTime(days: { plates: Plate[] }[], meal: string): string | null {
  const times: number[] = [];
  for (const d of days) {
    const first = d.plates.filter((p) => p.meal === meal).sort((a, b) => a.eatenAt - b.eatenAt)[0];
    if (first) times.push(minutesOf(first.eatenAt));
  }
  if (times.length === 0) return null;
  times.sort((a, b) => a - b);
  const mid =
    times.length % 2
      ? times[(times.length - 1) / 2]
      : Math.round((times[times.length / 2 - 1] + times[times.length / 2]) / 2);
  return clockOf(mid);
}

// The dishes of the week, most often first, with how many times each came. Ties keep the name order so the list does not jump.
export function topDishes(days: { plates: Plate[] }[], max = 6): { name: string; times: number }[] {
  const seen = new Map<string, number>();
  for (const d of days)
    for (const p of d.plates) seen.set(p.foodName, (seen.get(p.foodName) ?? 0) + p.count);
  return [...seen.entries()]
    .map(([name, times]) => ({ name, times }))
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    .slice(0, max);
}

// One plain line about today's plate: which groups came, and which have not come yet. A fact, never a judgement.
export function plateLine(groups: Groups): string {
  const came = GROUPS.filter((g) => groups[g] > 0);
  if (came.length === 0) return "No plate yet today. Log when you have eaten.";
  if (came.length === GROUPS.length) return "Every food group has come to the plate today.";
  const notYet = GROUPS.filter((g) => groups[g] === 0).map((g) => GROUP_WORDS[g].toLowerCase());
  return `Not on the plate yet today: ${notYet.join(", ")}.`;
}

// The kitchen lamp's tips, one per group. The lamp shows the group that came least this week first, then the others in turn.
export const KITCHEN_TIPS: Record<Group, { title: string; body: string; image: string }> = {
  grain: {
    title: "Anna, the steady fire",
    body: "Roti, rice, poha or upma carry the long hours of study. A plate with one of them sits longer.",
    image: "/meals/thali.jpg",
  },
  dal: {
    title: "Dal keeps the lamp lit",
    body: "Dal, chana, rajma, paneer, egg or sprouts. A small bowl at lunch or dinner is an easy way in.",
    image: "/meals/plate.jpg",
  },
  vegetable: {
    title: "A sabzi on the side",
    body: "Any sabzi counts, cooked or raw. A few slices of cucumber or carrot with lunch is enough to start.",
    image: "/meals/thali.jpg",
  },
  dairy: {
    title: "Dahi, the quiet helper",
    body: "Dahi, chaas, milk or paneer. A bowl of dahi with lunch is the house's old habit.",
    image: "/meals/dahi.jpg",
  },
  fruit: {
    title: "Fruit at snack time",
    body: "A banana, guava, orange or seasonal fruit fits in a bag and needs no plate.",
    image: "/meals/plate.jpg",
  },
};

export function lampOrder(week: Groups[]): Group[] {
  const totals = Object.fromEntries(
    GROUPS.map((g) => [g, week.reduce((s, d) => s + d[g], 0)]),
  ) as Groups;
  return [...GROUPS].sort((a, b) => totals[a] - totals[b] || GROUPS.indexOf(a) - GROUPS.indexOf(b));
}
