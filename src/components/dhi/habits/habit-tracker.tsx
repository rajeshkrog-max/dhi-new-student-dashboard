/**
 * Habit Tracker — colour, streak fire, weekly/monthly graph, DHI news.
 * Five habits. Write your own. Motivation, not shame.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@dhi/backend/api";
import {
  HABIT_TIPS,
  MAX_HABITS,
  addDays,
  bestStreak,
  colorOf,
  currentStreak,
  dayEndsAt,
  dhiRating,
  finishedPlans,
  glyphOf,
  habitScores,
  insight,
  isLit,
  leadingHabit,
  longestStreak,
  nextFlag,
  openPlans,
  river,
  runningPlans,
  storeFromServer,
  tally,
  todayKey,
  type HabitPlan,
  type HabitStore,
} from "@/lib/dhi/habits";
import {
  DAY_MOVED_ON,
  DRAFT_NOTE,
  FINISHED_NOTE,
  FINISHED_TITLE,
  HABIT_WORDS_APPROVED,
  habitRefusal,
  startsOn,
} from "@/lib/dhi/habits/words";
import { prettyDate } from "@/lib/dhi/mood-demo";
import { Notice } from "@/components/dhi/ui/notice";
import { useMediaQuery } from "@/lib/use-touch";
import { cn } from "@/lib/utils";
import { HabitCompose } from "./habit-compose";
import { HabitSlide } from "./habit-slide";
import { HabitFeels } from "./habit-feels";

const glass = "rounded-card border border-white/80 bg-white/70 shadow-sm backdrop-blur-xl";

// The habits room (spec house/0007). The habits and their ticks are the student's own, read from the server; ticking, undoing, adding and removing
// write there. Streaks, tallies and charts are worked out here from the ticks. The day shown as today comes from the shared day rule and moves on
// at 04:00.
export function HabitTracker() {
  const rows = useQuery(api.habits.list, {});
  const setToday = useMutation(api.habits.setToday);
  const addHabit = useMutation(api.habits.add);
  const removeHabit = useMutation(api.habits.remove);
  const [compose, setCompose] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [scope, setScope] = useState<"week" | "month">("week");
  const [tip, setTip] = useState(0);
  const [fail, setFail] = useState("");
  const [dayMoved, setDayMoved] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [today, setTodayKey] = useState(() => todayKey());
  const narrow = useMediaQuery("(max-width: 639.98px)");

  // The next 04:00 moves the shown day on, and says so.
  const shownDay = useRef(today);
  useEffect(() => {
    const t = window.setTimeout(
      () => setTodayKey(todayKey()),
      Math.max(1000, dayEndsAt(today) - Date.now()) + 50,
    );
    // A timer stops while a phone sleeps, so the day is also looked at again when the screen wakes or the tab comes back, and once a minute.
    const look = () => setTodayKey((shown) => (todayKey() === shown ? shown : todayKey()));
    const every = window.setInterval(look, 60_000);
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    window.addEventListener("pageshow", look);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
      window.removeEventListener("pageshow", look);
    };
  }, [today]);
  useEffect(() => {
    if (shownDay.current === today) return;
    shownDay.current = today;
    setDayMoved(true);
    setFail("");
  }, [today]);

  const store: HabitStore = useMemo(() => storeFromServer(rows ?? []), [rows]);
  const open = useMemo(() => openPlans(store, today), [store, today]);
  const running = useMemo(() => runningPlans(store, today), [store, today]);
  const finished = useMemo(() => finishedPlans(store, today), [store, today]);
  const remaining = MAX_HABITS - open.length;
  const doneToday = running.filter((p) => isLit(store, p.id, today)).length;
  const weekFrom = addDays(today, -6);
  const monthFrom = addDays(today, -29);
  const weekScores = habitScores(store, running, weekFrom, today, today);
  const monthScores = habitScores(store, running, monthFrom, today, today);
  const scores = scope === "week" ? weekScores : monthScores;
  const rating = dhiRating(scores);
  const leader = leadingHabit(store, running, today);
  const leadStreak = leader ? currentStreak(store, leader, today) : 0;
  const leadBest = leader ? longestStreak(store, leader, today) : 0;
  const flag = nextFlag(leadStreak);
  const houseBest = bestStreak(store, running, today);
  const selected = store.plans.find((p) => p.id === pick);
  const news = HABIT_TIPS[tip % HABIT_TIPS.length];

  async function toggle(id: string) {
    if (busy.has(id)) return;
    setFail("");
    setBusy((s) => new Set(s).add(id));
    try {
      // A tick is a target state, so a stale tab that resends it changes nothing. The server's day wins over this device's clock.
      const r = await setToday({ planId: id, lit: !isLit(store, id, today) });
      if (!r.ok) setFail(habitRefusal(r.code));
      // The server's day wins: if it is not the day shown, move to it (the screen says so) instead of leaving a tap that did nothing.
      else if (r.day !== today) setTodayKey(r.day);
    } catch (e) {
      setFail(habitRefusal(e));
    }
    setBusy((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  async function removePlan(id: string) {
    setFail("");
    try {
      const r = await removeHabit({ planId: id });
      if (!r.ok) setFail(habitRefusal(r.code));
    } catch (e) {
      setFail(habitRefusal(e));
    }
  }

  // Resolves to a plain line when the server refuses, so the form can show it and stay open; to null when the habit was made.
  async function create(
    title: string,
    startOn: string,
    endOn: string,
    catalogId: string | null,
    color: string,
  ): Promise<string | null> {
    try {
      const r = await addHabit({ kind: catalogId ?? "custom", title, color, startOn, endOn });
      return r.ok ? null : habitRefusal(r.code);
    } catch (e) {
      return habitRefusal(e);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">
          Five habits. Colour them. Tick today. Watch the streak walk to the next flag.
        </p>
        <button
          type="button"
          disabled={remaining <= 0 || rows === undefined}
          onClick={() => setCompose(true)}
          className="flex h-11 items-center gap-2 rounded-full bg-grove px-4 text-sm font-medium text-paper disabled:opacity-40"
        >
          <Plus className="size-4" /> New habit
        </button>
      </div>

      {fail && (
        <Notice tone="danger" role="alert" data-testid="habit-error" className="px-4 py-3 text-sm">
          {fail}
        </Notice>
      )}
      {dayMoved && (
        <Notice role="status" data-testid="habit-day-moved" className="px-4 py-3 text-sm">
          {DAY_MOVED_ON}
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Today"
          value={`${doneToday} / ${running.length || 0}`}
          note="habits done"
          tone="mint"
        />
        <Tile
          label="Best streak"
          value={`${houseBest}d`}
          note={leader ? leader.title : "no habit yet"}
          tone="peach"
          fire
        />
        <Tile label="Week rating" value={`${rating.toFixed(1)} / 5`} note="DHI score" tone="gold" />
        <Tile
          label="Leading now"
          value={leader ? `${leadStreak}d` : "—"}
          note={leader ? leader.title : "tick one today"}
          tone="lilac"
        />
      </div>

      <article className={cn(glass, "p-4 sm:p-6")}>
        <h3 className="font-display text-2xl">Today’s habits</h3>
        <p className="text-sm text-mute">Tap the circle. Open the card for the streak.</p>
        {rows === undefined ? (
          <p className="mt-6 text-sm text-mute">Loading…</p>
        ) : open.length === 0 ? (
          <p className="mt-6 text-sm text-mute">
            No habit yet. Write your own — water, sleep, a page.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {open.map((p) => (
              <HabitCard
                key={p.id}
                plan={p}
                store={store}
                today={today}
                notYet={p.startOn > today}
                busy={busy.has(p.id)}
                onToggle={() => void toggle(p.id)}
                onOpen={() => setPick(p.id)}
                onRemove={() => void removePlan(p.id)}
              />
            ))}
          </ul>
        )}
      </article>

      {finished.length > 0 && (
        <article className={cn(glass, "p-4 sm:p-6")} data-testid="habit-finished">
          <h3 className="font-display text-2xl">{FINISHED_TITLE}</h3>
          <p className="text-sm text-mute">{FINISHED_NOTE}</p>
          <ul className="mt-4 space-y-2">
            {finished.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-control bg-white px-3 py-2 text-sm"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorOf(p) }}
                />
                <button
                  type="button"
                  onClick={() => setPick(p.id)}
                  className="min-w-0 flex-1 truncate text-left touch:min-h-11"
                >
                  {p.title}
                </button>
                <span className="text-xs text-mute">best {tally(store, p, today).best}d</span>
                <button
                  type="button"
                  onClick={() => void removePlan(p.id)}
                  className="text-mute touch:grid touch:size-11 touch:place-items-center"
                  aria-label={`Remove ${p.title}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <article className={cn(glass, "p-4 sm:p-6")}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl">
                {scope === "week" ? "Week wheel" : "Month bars"}
              </h3>
              <p className="text-xs text-mute">
                <span className="touch:hidden">Hover</span>
                <span className="hidden touch:inline">Tap</span> a slice or bar — name, days kept,
                percent.
              </p>
            </div>
            <div className="flex rounded-full bg-white p-1 text-xs">
              {(["week", "month"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 capitalize touch:min-h-11 touch:px-4",
                    scope === s && "bg-home text-paper",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {scope === "week" ? (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-52 w-52 shrink-0">
                {/* The ring repeats the list beside it, which a screen reader reads, so only the drawing is hidden from it (WCAG 1.1.1). */}
                <div className="absolute inset-0" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart accessibilityLayer={false}>
                      <Pie
                        rootTabIndex={-1}
                        data={
                          weekScores.every((s) => !s.done)
                            ? [{ name: "empty", pct: 1, color: "var(--color-sand-deep)" }]
                            : weekScores.map((s) => ({ ...s, value: Math.max(s.pct, 1) }))
                        }
                        dataKey={weekScores.every((s) => !s.done) ? "pct" : "value"}
                        innerRadius={62}
                        outerRadius={86}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {(weekScores.every((s) => !s.done)
                          ? [{ color: "var(--color-sand-deep)" }]
                          : weekScores
                        ).map((s, i) => (
                          <Cell key={i} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ScoreTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="font-display text-3xl leading-none">{rating.toFixed(1)}</p>
                    <p className="text-[11px] text-mute touch:text-xs">/ 5 DHI</p>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                {weekScores.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {s.glyph} {s.name}
                    </span>
                    <span className="tabular-nums text-mute">
                      {s.done}/{s.possible}
                    </span>
                    <span className="w-10 text-right tabular-nums font-medium">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthScores}
                  layout="vertical"
                  margin={narrow ? { left: 0, right: 8 } : { left: 8, right: 16 }}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={narrow ? 84 : 118}
                    tick={narrow ? <ClippedTick /> : { fontSize: 11, fill: "var(--color-home)" }}
                    axisLine={false}
                    tickLine={false}
                  />
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

        <article className={cn(glass, "p-4 sm:p-6")}>
          {leader ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
                Live streak
              </p>
              <p className="font-display mt-1 text-2xl">{leader.title}</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="streak-fire text-4xl">🔥</span>
                <p className="font-display text-5xl leading-none">{leadStreak}</p>
                <p className="pb-1 text-sm text-mute">days · best {leadBest}</p>
              </div>
              <div className="relative mt-5">
                <div className="h-2.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber to-gold"
                    style={{ width: `${flag.fill * 100}%` }}
                  />
                </div>
                <Flag
                  className="absolute -top-1 size-4 text-danger"
                  style={{ left: `calc(${Math.min(96, flag.fill * 100)}% - 8px)` }}
                />
              </div>
              <p className="mt-2 text-xs text-mute">
                Next flag for {leader.title}: {flag.target} days ({flag.left} to go)
              </p>
              <ul className="mt-5 space-y-2">
                {[...running]
                  .sort((a, b) => currentStreak(store, b, today) - currentStreak(store, a, today))
                  .map((p) => {
                    const n = currentStreak(store, p, today);
                    const b = longestStreak(store, p, today);
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: colorOf(p) }}
                        />
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
        <div className="p-4 sm:p-6">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
            <Sparkles className="size-3" /> DHI habit lamp
          </p>
          <h3 className="font-display mt-2 text-2xl">{news.title}</h3>
          <p className="mt-2 text-sm text-mute">{news.body}</p>
          <button
            type="button"
            onClick={() => setTip((n) => n + 1)}
            className="tap mt-4 text-xs text-grove touch:-ml-3 touch:inline-flex touch:items-center touch:justify-center touch:px-3"
          >
            Next insight
          </button>
        </div>
      </article>

      {compose && (
        <HabitCompose
          remaining={remaining}
          onClose={() => setCompose(false)}
          today={today}
          onSave={async (title, startOn, endOn, catalogId, color) => {
            const problem = await create(title, startOn, endOn, catalogId, color);
            if (!problem) setCompose(false);
            return problem;
          }}
        />
      )}

      {selected && (
        <HabitSlide
          plan={selected}
          store={store}
          today={today}
          onClose={() => setPick(null)}
          onToggle={() => void toggle(selected.id)}
        />
      )}

      {rows !== undefined && running.length > 0 && <HabitFeels habits={running.map((p) => ({ id: p.id, title: p.title }))} />}

      {!HABIT_WORDS_APPROVED && (
        <p className="text-xs text-mute touch:text-sm" data-testid="habit-draft">
          {DRAFT_NOTE}
        </p>
      )}
    </div>
  );
}

function HabitCard({
  plan,
  store,
  today,
  notYet,
  busy,
  onToggle,
  onOpen,
  onRemove,
}: {
  plan: HabitPlan;
  store: HabitStore;
  today: string;
  notYet: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = tally(store, plan, today);
  const done = isLit(store, plan.id, today);
  const days = river(store, plan, 7, today);
  const color = colorOf(plan);

  return (
    <li className="overflow-hidden rounded-card bg-white shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={notYet || busy}
            data-testid="habit-tick"
            aria-label={done ? `Undo ${plan.title}` : `Done ${plan.title}`}
            className="grid size-12 shrink-0 place-items-center rounded-full text-lg text-paper transition disabled:opacity-50"
            style={{
              backgroundColor: done ? color : "var(--color-sand)",
              color: done ? "var(--color-paper)" : "var(--color-home)",
            }}
          >
            {glyphOf(plan)}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left touch:min-h-11"
          >
            <p className="font-medium">{plan.title}</p>
            <p className="text-xs text-mute">
              {notYet ? (
                startsOn(prettyDate(plan.startOn))
              ) : (
                <>
                  {t.streak > 0 && <span className="streak-fire mr-1 text-sm">🔥</span>}
                  {t.streak} day streak · best {t.best}
                </>
              )}
            </p>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-mute touch:-mr-2 touch:grid touch:size-11 touch:place-items-center"
            aria-label={`Remove ${plan.title}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {days.map((d) => (
            <span
              key={d.date}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: d.lit ? color : "var(--color-sand)" }}
            />
          ))}
        </div>
        {!notYet && (
          <p className="mt-2 text-xs" style={{ color }}>
            {insight(store, plan, today)}
          </p>
        )}
      </div>
    </li>
  );
}

// The phone axis has 84 pixels for a name, so long names are cut short rather than overlap the bars.
function ClippedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const name = payload?.value ?? "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--color-home)">
      {name.length > 12 ? `${name.slice(0, 11)}…` : name}
    </text>
  );
}

function ScoreTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; done: number; possible: number; pct: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const s = payload[0].payload;
  if (!s.name || s.name === "empty") return null;
  return (
    <div className="rounded-chip bg-home px-3 py-2 text-xs text-paper shadow-lg">
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
  const bg = { mint: "bg-mint/40", gold: "bg-gold/40", lilac: "bg-lilac/35", peach: "bg-peach/40" }[
    tone
  ];
  return (
    <article className={cn("rounded-card border border-white/80 p-4 backdrop-blur-xl", bg)}>
      <p className="text-xs text-mute">{label}</p>
      <p className="font-display mt-1 text-2xl">
        {fire && <span className="streak-fire mr-1 text-xl">🔥</span>}
        {value}
      </p>
      <p className="text-xs text-grove">{note}</p>
    </article>
  );
}
