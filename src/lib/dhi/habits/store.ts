/**
 * Client store for habit_plans + habit_checks.
 * Same mutations we will POST later: addPlan, lightToday, unlightToday.
 */

import { uid } from "@/lib/dhi/id";
import { CATALOG } from "./catalog";
import { emptyHabitStore, MAX_HABITS, MILESTONES, STORE_KEY, STUDENT_ID, type HabitCheck, type HabitPlan, type HabitStore } from "./schema";

export { MAX_HABITS, STUDENT_ID } from "./schema";

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayKey(dt);
}

function spine(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
    if (out.length > 400) break;
  }
  return out;
}

function seed(): HabitStore {
  const t = todayKey();
  const water: HabitPlan = {
    id: "plan_water",
    studentId: STUDENT_ID,
    catalogId: "water",
    title: "Eight glasses of water",
    color: "#3d6ea8",
    startOn: addDays(t, -10),
    endOn: addDays(t, 20),
    createdAt: addDays(t, -10) + "T08:00:00",
  };
  const sleep: HabitPlan = {
    id: "plan_sleep",
    studentId: STUDENT_ID,
    catalogId: "sleep",
    title: "Sleep before eleven",
    color: "#6b5b95",
    startOn: addDays(t, -7),
    endOn: addDays(t, 14),
    createdAt: addDays(t, -7) + "T21:00:00",
  };
  const page: HabitPlan = {
    id: "plan_page",
    studentId: STUDENT_ID,
    catalogId: "page",
    title: "One honest page",
    color: "#e8c36a",
    startOn: addDays(t, -5),
    endOn: addDays(t, 16),
    createdAt: addDays(t, -5) + "T07:00:00",
  };
  const checks: HabitCheck[] = [];
  for (let i = 10; i >= 1; i--) {
    if (i === 3 || i === 6) continue;
    const on = addDays(t, -i);
    checks.push({
      id: `chk_w_${on}`,
      planId: water.id,
      studentId: STUDENT_ID,
      loggedOn: on,
      lit: true,
      createdAt: on + "T20:00:00",
    });
  }
  for (let i = 7; i >= 1; i--) {
    if (i === 1) continue;
    const on = addDays(t, -i);
    checks.push({
      id: `chk_s_${on}`,
      planId: sleep.id,
      studentId: STUDENT_ID,
      loggedOn: on,
      lit: true,
      createdAt: on + "T22:30:00",
    });
  }
  for (let i = 5; i >= 2; i--) {
    const on = addDays(t, -i);
    checks.push({
      id: `chk_p_${on}`,
      planId: page.id,
      studentId: STUDENT_ID,
      loggedOn: on,
      lit: true,
      createdAt: on + "T19:00:00",
    });
  }
  return { studentId: STUDENT_ID, plans: [water, sleep, page], checks };
}

export function loadHabits(): HabitStore {
  if (typeof window === "undefined") return emptyHabitStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as HabitStore;
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

export function saveHabits(store: HabitStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function openPlans(store: HabitStore, on = todayKey()) {
  return store.plans.filter((p) => p.startOn <= on && p.endOn >= on);
}

export function checksFor(store: HabitStore, planId: string) {
  return store.checks.filter((c) => c.planId === planId && c.lit);
}

export function isLit(store: HabitStore, planId: string, on = todayKey()) {
  return store.checks.some((c) => c.planId === planId && c.loggedOn === on && c.lit);
}

export function windowDays(plan: HabitPlan, until = todayKey()) {
  const last = until < plan.endOn ? until : plan.endOn;
  if (last < plan.startOn) return [];
  return spine(plan.startOn, last);
}

export function currentStreak(store: HabitStore, plan: HabitPlan) {
  const today = todayKey();
  let cursor = isLit(store, plan.id, today) ? today : addDays(today, -1);
  if (cursor > plan.endOn) cursor = plan.endOn;
  let n = 0;
  while (cursor >= plan.startOn && isLit(store, plan.id, cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function longestStreak(store: HabitStore, plan: HabitPlan) {
  const days = windowDays(plan);
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (isLit(store, plan.id, d)) {
      run += 1;
      if (run > best) best = run;
    } else if (d < todayKey()) {
      run = 0;
    }
  }
  return best;
}

export function tally(store: HabitStore, plan: HabitPlan, until = todayKey()) {
  const days = windowDays(plan, until);
  const yesterday = addDays(todayKey(), -1);
  let lit = 0;
  let miss = 0;
  for (const d of days) {
    const on = isLit(store, plan.id, d);
    if (on) lit += 1;
    else if (d <= yesterday) miss += 1;
  }
  return { days: days.length, lit, miss, streak: currentStreak(store, plan), best: longestStreak(store, plan) };
}

export function rangeScore(store: HabitStore, plan: HabitPlan, from: string, to: string) {
  const start = from < plan.startOn ? plan.startOn : from;
  const last = to > plan.endOn ? plan.endOn : to;
  const cap = last < todayKey() ? last : todayKey();
  if (cap < start) return { done: 0, possible: 0, pct: 0 };
  const days = spine(start, cap);
  const done = days.filter((d) => isLit(store, plan.id, d)).length;
  return { done, possible: days.length, pct: days.length ? Math.round((done / days.length) * 100) : 0 };
}

export function glyphOf(plan: HabitPlan) {
  return CATALOG.find((c) => c.id === plan.catalogId)?.glyph ?? "✦";
}

export function habitScores(store: HabitStore, plans: HabitPlan[], from: string, to: string) {
  return plans.map((p) => {
    const s = rangeScore(store, p, from, to);
    return { id: p.id, name: p.title, color: p.color, glyph: glyphOf(p), ...s };
  });
}

export function dhiRating(scores: { done: number; possible: number }[]) {
  const possible = scores.reduce((a, s) => a + s.possible, 0);
  const done = scores.reduce((a, s) => a + s.done, 0);
  if (!possible) return 0;
  return Math.round((done / possible) * 50) / 10;
}

export function river(store: HabitStore, plan: HabitPlan, n = 21) {
  const end = todayKey() < plan.endOn ? todayKey() : plan.endOn;
  const start = addDays(end, -(n - 1));
  const from = start < plan.startOn ? plan.startOn : start;
  return spine(from, end).map((d) => ({
    date: d,
    lit: isLit(store, plan.id, d),
    future: d > todayKey(),
  }));
}

export function lightToday(store: HabitStore, planId: string, on = todayKey()) {
  if (isLit(store, planId, on)) return store;
  const check: HabitCheck = {
    id: uid(),
    planId,
    studentId: store.studentId,
    loggedOn: on,
    lit: true,
    createdAt: new Date().toISOString(),
  };
  const next = { ...store, checks: [...store.checks, check] };
  saveHabits(next);
  return next;
}

export function unlightToday(store: HabitStore, planId: string, on = todayKey()) {
  const next = { ...store, checks: store.checks.filter((c) => !(c.planId === planId && c.loggedOn === on)) };
  saveHabits(next);
  return next;
}

export function addPlan(store: HabitStore, title: string, startOn: string, endOn: string, catalogId: string | null, color: string) {
  if (openPlans(store).length >= MAX_HABITS) return store;
  const plan: HabitPlan = {
    id: uid(),
    studentId: store.studentId,
    catalogId,
    title: title.trim(),
    color,
    startOn,
    endOn,
    createdAt: new Date().toISOString(),
  };
  const next = { ...store, plans: [...store.plans, plan] };
  saveHabits(next);
  return next;
}

export function removePlan(store: HabitStore, planId: string) {
  const next = {
    ...store,
    plans: store.plans.filter((p) => p.id !== planId),
    checks: store.checks.filter((c) => c.planId !== planId),
  };
  saveHabits(next);
  return next;
}

export function colorOf(plan: HabitPlan) {
  return plan.color || CATALOG.find((c) => c.id === plan.catalogId)?.color || "#2f6b3a";
}

export function bestStreak(store: HabitStore, plans: HabitPlan[]) {
  return Math.max(0, ...plans.map((p) => longestStreak(store, p)));
}

export function leadingHabit(store: HabitStore, plans: HabitPlan[]) {
  if (!plans.length) return null;
  return [...plans].sort((a, b) => currentStreak(store, b) - currentStreak(store, a) || longestStreak(store, b) - longestStreak(store, a))[0];
}

export function nextFlag(streak: number) {
  const target = MILESTONES.find((m) => m > streak) ?? MILESTONES[MILESTONES.length - 1];
  const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const span = Math.max(1, target - prev);
  const fill = Math.min(1, (streak - prev) / span);
  return { target, prev, fill, left: Math.max(0, target - streak) };
}

export function weekSeries(store: HabitStore, plans: HabitPlan[]) {
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(todayKey(), -i);
    const done = plans.filter((p) => p.startOn <= d && p.endOn >= d && isLit(store, p.id, d)).length;
    const open = plans.filter((p) => p.startOn <= d && p.endOn >= d).length;
    rows.push({ label: String(Number(d.slice(8))), done, open, date: d });
  }
  return rows;
}

export function monthSeries(store: HabitStore, plans: HabitPlan[]) {
  const rows = [];
  for (let i = 3; i >= 0; i--) {
    const end = addDays(todayKey(), -i * 7);
    const start = addDays(end, -6);
    let done = 0;
    let open = 0;
    for (const d of spine(start, end)) {
      const live = plans.filter((p) => p.startOn <= d && p.endOn >= d);
      open += live.length;
      done += live.filter((p) => isLit(store, p.id, d)).length;
    }
    rows.push({ label: `W${4 - i}`, done, open, date: start });
  }
  return rows;
}

export function insight(store: HabitStore, plan: HabitPlan) {
  const { lit, streak } = tally(store, plan);
  if (isLit(store, plan.id) && streak >= 3) return `Great job today. ${streak}-day streak — same hour tomorrow.`;
  if (isLit(store, plan.id)) return "Great job today. The next flag is closer than it looks.";
  if (streak >= 7) return "Seven days. Your body is already waiting for this hour.";
  if (streak >= 3) return `${streak} in a row. One more morning and it starts to sit by itself.`;
  if (lit === 0) return "Start small. One tick today is the whole win.";
  return `${lit} days kept in this window. Consistency is the only fuel.`;
}
