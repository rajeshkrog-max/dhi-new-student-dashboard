/**
 * Pure helpers for the habits room (spec house/0007). The habits and their ticks come from the server (`habits.list`); the screen turns them into a
 * `HabitStore` and these functions work out the streaks, tallies, charts and rating when the student looks. Nothing here is stored, and nothing reads
 * a clock except `todayKey`, which uses the shared day rule (04:00 to 04:00 India time) on the device clock.
 */

import { dayBounds, shiftDay, todayOf } from "@dhi/backend/dayRules";
import { CATALOG } from "./catalog.ts";
import { MILESTONES, type HabitCheck, type HabitPlan, type HabitStore } from "./schema.ts";

export { MAX_HABITS } from "./schema.ts";

export function todayKey() {
  return todayOf(Date.now());
}

export function addDays(iso: string, n: number) {
  return shiftDay(iso, n);
}

// When the shown day ends (the next 04:00), for the screen's timer.
export function dayEndsAt(day: string) {
  return dayBounds(day).end;
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

// A habit is open until its end day passes, and a habit that starts in the future is open too (the server counts it toward the five). The list the
// server sends already leaves out removed habits.
export function openPlans(store: HabitStore, on = todayKey()) {
  return store.plans.filter((p) => p.endOn >= on);
}

// Open and already running: the ones that can be ticked today.
export function runningPlans(store: HabitStore, on = todayKey()) {
  return store.plans.filter((p) => p.startOn <= on && p.endOn >= on);
}

export function finishedPlans(store: HabitStore, on = todayKey()) {
  return store.plans.filter((p) => p.endOn < on);
}

// The server's habits and ticks as the store the helpers below read. The lit days are indexed once here.
export function storeFromServer(rows: { id: string; kind: string; title: string; color: string; startOn: string; endOn: string; ticks: string[] }[]): HabitStore {
  const plans: HabitPlan[] = rows.map((r) => ({ id: r.id, studentId: "", catalogId: r.kind === "custom" ? null : r.kind, title: r.title, color: r.color, startOn: r.startOn, endOn: r.endOn, createdAt: "" }));
  const checks: HabitCheck[] = rows.flatMap((r) => r.ticks.map((d) => ({ id: `${r.id}:${d}`, planId: r.id, studentId: "", loggedOn: d, lit: true, createdAt: "" })));
  const index = new Map<string, Set<string>>(rows.map((r) => [r.id, new Set(r.ticks)]));
  return { studentId: "", plans, checks, index };
}

export function checksFor(store: HabitStore, planId: string) {
  return store.checks.filter((c) => c.planId === planId && c.lit);
}

export function isLit(store: HabitStore, planId: string, on = todayKey()) {
  if (store.index) return store.index.get(planId)?.has(on) ?? false;
  return store.checks.some((c) => c.planId === planId && c.loggedOn === on && c.lit);
}

// Every helper below takes the day it should read (`today`), so a screen draws one render from one day. The default is the live clock.
export function windowDays(plan: HabitPlan, until = todayKey()) {
  const last = until < plan.endOn ? until : plan.endOn;
  if (last < plan.startOn) return [];
  return spine(plan.startOn, last);
}

export function currentStreak(store: HabitStore, plan: HabitPlan, today = todayKey()) {
  let cursor = isLit(store, plan.id, today) ? today : addDays(today, -1);
  if (cursor > plan.endOn) cursor = plan.endOn;
  let n = 0;
  while (cursor >= plan.startOn && isLit(store, plan.id, cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function longestStreak(store: HabitStore, plan: HabitPlan, today = todayKey()) {
  const days = windowDays(plan, today);
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (isLit(store, plan.id, d)) {
      run += 1;
      if (run > best) best = run;
    } else if (d < today) {
      run = 0;
    }
  }
  return best;
}

export function tally(store: HabitStore, plan: HabitPlan, today = todayKey()) {
  const days = windowDays(plan, today);
  const yesterday = addDays(today, -1);
  let lit = 0;
  let miss = 0;
  for (const d of days) {
    const on = isLit(store, plan.id, d);
    if (on) lit += 1;
    else if (d <= yesterday) miss += 1;
  }
  return { days: days.length, lit, miss, streak: currentStreak(store, plan, today), best: longestStreak(store, plan, today) };
}

export function rangeScore(store: HabitStore, plan: HabitPlan, from: string, to: string, today = todayKey()) {
  const start = from < plan.startOn ? plan.startOn : from;
  const last = to > plan.endOn ? plan.endOn : to;
  const cap = last < today ? last : today;
  if (cap < start) return { done: 0, possible: 0, pct: 0 };
  const days = spine(start, cap);
  const done = days.filter((d) => isLit(store, plan.id, d)).length;
  return { done, possible: days.length, pct: days.length ? Math.round((done / days.length) * 100) : 0 };
}

export function glyphOf(plan: HabitPlan) {
  return CATALOG.find((c) => c.id === plan.catalogId)?.glyph ?? "✦";
}

export function habitScores(store: HabitStore, plans: HabitPlan[], from: string, to: string, today = todayKey()) {
  return plans.map((p) => {
    const s = rangeScore(store, p, from, to, today);
    return { id: p.id, name: p.title, color: p.color, glyph: glyphOf(p), ...s };
  });
}

export function dhiRating(scores: { done: number; possible: number }[]) {
  const possible = scores.reduce((a, s) => a + s.possible, 0);
  const done = scores.reduce((a, s) => a + s.done, 0);
  if (!possible) return 0;
  return Math.round((done / possible) * 50) / 10;
}

export function river(store: HabitStore, plan: HabitPlan, n = 21, today = todayKey()) {
  const end = today < plan.endOn ? today : plan.endOn;
  const start = addDays(end, -(n - 1));
  const from = start < plan.startOn ? plan.startOn : start;
  return spine(from, end).map((d) => ({
    date: d,
    lit: isLit(store, plan.id, d),
    future: d > today,
  }));
}

export function colorOf(plan: HabitPlan) {
  return plan.color || CATALOG.find((c) => c.id === plan.catalogId)?.color || "#2f6b3a";
}

export function bestStreak(store: HabitStore, plans: HabitPlan[], today = todayKey()) {
  return Math.max(0, ...plans.map((p) => longestStreak(store, p, today)));
}

export function leadingHabit(store: HabitStore, plans: HabitPlan[], today = todayKey()) {
  if (!plans.length) return null;
  const keyed = plans.map((p) => ({ p, now: currentStreak(store, p, today), best: longestStreak(store, p, today) }));
  keyed.sort((a, b) => b.now - a.now || b.best - a.best);
  return keyed[0].p;
}

export function nextFlag(streak: number) {
  const target = MILESTONES.find((m) => m > streak) ?? MILESTONES[MILESTONES.length - 1];
  const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const span = Math.max(1, target - prev);
  const fill = Math.min(1, (streak - prev) / span);
  return { target, prev, fill, left: Math.max(0, target - streak) };
}

export function weekSeries(store: HabitStore, plans: HabitPlan[], today = todayKey()) {
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const done = plans.filter((p) => p.startOn <= d && p.endOn >= d && isLit(store, p.id, d)).length;
    const open = plans.filter((p) => p.startOn <= d && p.endOn >= d).length;
    rows.push({ label: String(Number(d.slice(8))), done, open, date: d });
  }
  return rows;
}

export function monthSeries(store: HabitStore, plans: HabitPlan[], today = todayKey()) {
  const rows = [];
  for (let i = 3; i >= 0; i--) {
    const end = addDays(today, -i * 7);
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

export function insight(store: HabitStore, plan: HabitPlan, today = todayKey()) {
  const { lit, streak } = tally(store, plan, today);
  if (isLit(store, plan.id, today) && streak >= 3) return `Great job today. ${streak}-day streak — same hour tomorrow.`;
  if (isLit(store, plan.id, today)) return "Great job today. The next flag is closer than it looks.";
  if (streak >= 7) return "Seven days. Your body is already waiting for this hour.";
  if (streak >= 3) return `${streak} in a row. One more morning and it starts to sit by itself.`;
  if (lit === 0) return "Start small. One tick today is the whole win.";
  return `${lit} days kept in this window. Consistency is the only fuel.`;
}
