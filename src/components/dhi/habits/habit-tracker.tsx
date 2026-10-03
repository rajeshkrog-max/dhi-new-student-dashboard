/**
 * Habit Tracker — colour, streak fire, weekly/monthly graph, DHI news.
 * Five habits. Write your own. Motivation, not shame.
 */
import { useEffect, useMemo, useState } from "react";
import { Flag, Plus, Sparkles, Trash2 } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  HABIT_TIPS,
  MAX_HABITS,
  addDays,
  addPlan,
  bestStreak,
  colorOf,
  currentStreak,
  dhiRating,
  glyphOf,
  habitScores,
  insight,
  isLit,
  leadingHabit,
  lightToday,
  loadHabits,
  longestStreak,
  nextFlag,
  openPlans,
  removePlan,
  river,
  tally,
  todayKey,
  unlightToday,
  type HabitPlan,
  type HabitStore,
} from "@/lib/dhi/habits";
import { cn } from "@/lib/utils";
import { HabitCompose } from "./habit-compose";
import { HabitSlide } from "./habit-slide";

const glass = "rounded-[24px] border border-white/80 bg-white/70 shadow-sm backdrop-blur-xl";

export function HabitTracker() {
  const [store, setStore] = useState<HabitStore>({ studentId: "", plans: [], checks: [] });
  const [compose, setCompose] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [scope, setScope] = useState<"week" | "month">("week");
  const [tip, setTip] = useState(0);
  const today = todayKey();

  useEffect(() => {
    setStore(loadHabits());
  }, []);

  const open = useMemo(() => openPlans(store, today), [store, today]);
  const remaining = MAX_HABITS - open.length;
  const doneToday = open.filter((p) => isLit(store, p.id, today)).length;
  const weekFrom = addDays(today, -6);
  const monthFrom = addDays(today, -29);
  const weekScores = habitScores(store, open, weekFrom, today);
  const monthScores = habitScores(store, open, monthFrom, today);
  const scores = scope === "week" ? weekScores : monthScores;
  const rating = dhiRating(scores);
  const leader = leadingHabit(store, open);
  const leadStreak = leader ? currentStreak(store, leader) : 0;
  const leadBest = leader ? longestStreak(store, leader) : 0;
  const flag = nextFlag(leadStreak);
  const houseBest = bestStreak(store, open);
  const selected = store.plans.find((p) => p.id === pick);
  const news = HABIT_TIPS[tip % HABIT_TIPS.length];

  function toggle(id: string) {
    setStore((s) => (isLit(s, id) ? unlightToday(s, id) : lightToday(s, id)));
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">Five habits. Colour them. Tick today. Watch the streak walk to the next flag.</p>
        <button
          type="button"
          disabled={remaining <= 0}
          onClick={() => setCompose(true)}
          className="flex h-11 items-center gap-2 rounded-full bg-grove px-4 text-sm font-medium text-paper disabled:opacity-40"
        >
          <Plus className="size-4" /> New habit
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Today" value={`${doneToday} / ${open.length || 0}`} note="habits done" tone="mint" />
        <Tile
          label="Best streak"
          value={`${houseBest}d`}
          note={leader ? leader.title : "no habit yet"}
          tone="peach"
          fire
        />
        <Tile
          label="Week rating"
          value={`${rating.toFixed(1)} / 5`}
          note="DHI score"
          tone="gold"
        />
        <Tile
          label="Leading now"
          value={leader ? `${leadStreak}d` : "—"}
          note={leader ? leader.title : "tick one today"}
          tone="lilac"
        />
      </div>

      <article className={cn(glass, "p-6")}>
        <h3 className="font-display text-2xl">Today’s habits</h3>
        <p className="text-sm text-mute">Tap the circle. Open the card for the streak.</p>
        {open.length === 0 ? (
          <p className="mt-6 text-sm text-mute">No habit yet. Write your own — water, sleep, a page.</p>
        ) : (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {open.map((p) => (
              <HabitCard
                key={p.id}
                plan={p}
                store={store}
                today={today}
                onToggle={() => toggle(p.id)}
                onOpen={() => setPick(p.id)}
                onRemove={() => setStore(removePlan(store, p.id))}
              />
            ))}
          </ul>
        )}
      </article>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <article className={cn(glass, "p-6")}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl">{scope === "week" ? "Week wheel" : "Month bars"}</h3>
              <p className="text-xs text-mute">Hover a slice or bar — name, days kept, percent.</p>
            </div>
            <div className="flex rounded-full bg-white p-1 text-xs">
              {(["week", "month"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} className={cn("rounded-full px-3 py-1.5 capitalize", scope === s && "bg-home text-paper")}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {scope === "week" ? (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weekScores.every((s) => !s.done) ? [{ name: "empty", pct: 1, color: "#e8e4dc" }] : weekScores.map((s) => ({ ...s, value: Math.max(s.pct, 1) }))}
                      dataKey={weekScores.every((s) => !s.done) ? "pct" : "value"}
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {(weekScores.every((s) => !s.done) ? [{ color: "#e8e4dc" }] : weekScores).map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ScoreTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="font-display text-3xl leading-none">{rating.toFixed(1)}</p>
                    <p className="text-[11px] text-mute">/ 5 DHI</p>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                {weekScores.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="min-w-0 flex-1 truncate">{s.glyph} {s.name}</span>
                    <span className="tabular-nums text-mute">{s.done}/{s.possible}</span>
                    <span className="w-10 text-right tabular-nums font-medium">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthScores} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11, fill: "#2a2438" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ScoreTip />} />
                  <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={16}>
                    {monthScores.map((s) => (
                      <Cell key={s.id} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className={cn(glass, "p-6")}>
          {leader ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Live streak</p>
              <p className="font-display mt-1 text-2xl">{leader.title}</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="streak-fire text-4xl">🔥</span>
                <p className="font-display text-5xl leading-none">{leadStreak}</p>
                <p className="pb-1 text-sm text-mute">days · best {leadBest}</p>
              </div>
              <div className="relative mt-5">
                <div className="h-2.5 overflow-hidden rounded-full bg-[#efeae3]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#e08a3d] to-[#e8c36a]" style={{ width: `${flag.fill * 100}%` }} />
                </div>
                <Flag className="absolute -top-1 size-4 text-[#c45c4a]" style={{ left: `calc(${Math.min(96, flag.fill * 100)}% - 8px)` }} />
              </div>
              <p className="mt-2 text-xs text-mute">
                Next flag for {leader.title}: {flag.target} days ({flag.left} to go)
              </p>
              <ul className="mt-5 space-y-2">
                {[...open]
                  .sort((a, b) => currentStreak(store, b) - currentStreak(store, a))
                  .map((p) => {
                    const n = currentStreak(store, p);
                    const b = longestStreak(store, p);
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(p) }} />
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        <span className="tabular-nums">
                          {n > 0 ? "🔥" : ""} {n}d
                        </span>
                        <span className="text-xs text-mute">best {b}</span>
                      </li>
                    );
                  })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-mute">Add a habit to grow a streak.</p>
          )}
        </article>
      </div>

      <article className={cn(glass, "overflow-hidden lg:grid lg:grid-cols-[1.1fr_1fr]")}>
        <img src={news.image} alt="" className="h-44 w-full object-cover lg:h-full" />
        <div className="p-6">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute">
            <Sparkles className="size-3" /> DHI habit lamp
          </p>
          <h3 className="font-display mt-2 text-2xl">{news.title}</h3>
          <p className="mt-2 text-sm text-mute">{news.body}</p>
          <button type="button" onClick={() => setTip((n) => n + 1)} className="mt-4 text-xs text-grove">
            Next insight
          </button>
        </div>
      </article>

      {compose && (
        <HabitCompose
          remaining={remaining}
          onClose={() => setCompose(false)}
          onSave={(title, startOn, endOn, catalogId, color) => {
            setStore(addPlan(store, title, startOn, endOn, catalogId, color));
            setCompose(false);
          }}
        />
      )}

      {selected && <HabitSlide plan={selected} store={store} onClose={() => setPick(null)} onToggle={() => toggle(selected.id)} />}
    </div>
  );
}

function HabitCard({
  plan,
  store,
  today,
  onToggle,
  onOpen,
  onRemove,
}: {
  plan: HabitPlan;
  store: HabitStore;
  today: string;
  onToggle: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = tally(store, plan);
  const done = isLit(store, plan.id, today);
  const days = river(store, plan, 7);
  const color = colorOf(plan);

  return (
    <li className="overflow-hidden rounded-[22px] bg-white shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={done ? `Undo ${plan.title}` : `Done ${plan.title}`}
            className="grid size-12 shrink-0 place-items-center rounded-full text-lg text-paper transition"
            style={{ backgroundColor: done ? color : "#efeae3", color: done ? "#f6f1e8" : "#2a2438" }}
          >
            {glyphOf(plan)}
          </button>
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <p className="font-medium">{plan.title}</p>
            <p className="text-xs text-mute">
              {t.streak > 0 && <span className="streak-fire mr-1 text-sm">🔥</span>}
              {t.streak} day streak · best {t.best}
            </p>
          </button>
          <button type="button" onClick={onRemove} className="text-mute" aria-label={`Remove ${plan.title}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {days.map((d) => (
            <span key={d.date} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: d.lit ? color : "#efeae3" }} />
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color }}>
          {insight(store, plan)}
        </p>
      </div>
    </li>
  );
}

function ScoreTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; done: number; possible: number; pct: number } }[] }) {
  if (!active || !payload?.[0]) return null;
  const s = payload[0].payload;
  if (!s.name || s.name === "empty") return null;
  return (
    <div className="rounded-xl bg-home px-3 py-2 text-xs text-paper shadow-lg">
      <p className="font-medium">{s.name}</p>
      <p className="mt-0.5 text-paper/80">
        {s.done} of {s.possible} days · {s.pct}%
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
  fire,
}: {
  label: string;
  value: string;
  note: string;
  tone: "mint" | "gold" | "lilac" | "peach";
  fire?: boolean;
}) {
  const bg = { mint: "bg-mint/40", gold: "bg-gold/40", lilac: "bg-lilac/35", peach: "bg-peach/40" }[tone];
  return (
    <article className={cn("rounded-[24px] border border-white/80 p-4 backdrop-blur-xl", bg)}>
      <p className="text-xs text-mute">{label}</p>
      <p className="font-display mt-1 text-2xl">
        {fire && <span className="streak-fire mr-1 text-xl">🔥</span>}
        {value}
      </p>
      <p className="text-xs text-grove">{note}</p>
    </article>
  );
}
