// The meals room (spec house/0010, house/0009), drawn as the house mockup. A student logs a plate in one sheet: the meal, the time eaten and any
// number of foods from the catalog (or their own dish), each with a count. The room shows how many items came from each food group today, the
// plate as a ring of groups, the four meals with their plates, the week as groups by day with the usual time of each meal and the week's dishes,
// and the kitchen lamp. It counts groups only: never a calorie total, a protein total or a target, and no word calls a food good or bad (owner,
// 2026-10-28). Removing a plate voids it.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, XAxis } from "recharts";
import { Clock, Coffee, Cookie, Moon, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import { api } from "@dhi/backend/api";
import { dayBounds, todayOf } from "@dhi/backend/dayRules";
import { FOOD_GROUPS, MAX_COUNT, MEALS, PROCESSING } from "@dhi/backend/foodRules";
import { Sheet } from "@/components/dhi/sheet";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import {
  GROUPS,
  GROUP_WORDS,
  KITCHEN_TIPS,
  lampOrder,
  plateLine,
  topDishes,
  usualTime,
  type Groups,
} from "@/lib/dhi/meals-board";
import { cn } from "@/lib/utils";

const MEAL_WORDS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};
const MEAL_ICON = { breakfast: Coffee, lunch: Sun, dinner: Moon, snack: Cookie } as const;
const PROCESS_WORDS: Record<string, string> = {
  home_cooked: "Home cooked",
  packaged: "Packaged",
  fried: "Fried",
};
// Each group's colour, the same in the tiles, the ring and the week.
const GROUP_FILL: Record<string, string> = {
  grain: "var(--color-gold)",
  dal: "var(--color-lilac)",
  vegetable: "var(--color-mint)",
  dairy: "var(--color-peach)",
  fruit: "var(--color-amber)",
};
const GROUP_TINT: Record<string, string> = {
  grain: "bg-gold/40",
  dal: "bg-lilac/35",
  vegetable: "bg-mint/40",
  dairy: "bg-peach/40",
  fruit: "bg-amber/25",
};
const GROUP_BAR: Record<string, string> = {
  grain: "bg-gold",
  dal: "bg-lilac",
  vegetable: "bg-mint",
  dairy: "bg-peach",
  fruit: "bg-amber",
};

const WORDS: Record<string, string> = {
  rate_limited: "That was too many taps for now. Please wait a little.",
  bad_count: "Please pick a count from 1 to 20.",
  bad_meal: "Please pick a meal.",
  bad_time:
    "That time is not allowed. A meal can be logged up to a day back, and not in the future.",
  bad_name: "Please write the name of the dish.",
  bad_serving: "Please write the serving size.",
  bad_number: "Please check the numbers. They must be whole or decimal numbers, not negative.",
  bad_code: "Please pick a group and a processing type.",
  not_found: "We could not find that food.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};
const wordFor = (error: unknown): string => {
  const data = (error as { data?: { code?: string } } | null)?.data;
  return (data?.code && WORDS[data.code]) || "Something went wrong. Please try again.";
};
const pad = (n: number) => String(n).padStart(2, "0");
const clockNow = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const clockOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
const weekday = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  });

type PlateRow = {
  plateId: GenericId<"mealPlates">;
  meal: string;
  group: string;
  count: number;
  foodName: string;
  eatenAt: number;
};

export function MealsRoom() {
  // The screen's own house day, moved on at 04:00, so the day and the week are asked for again when the day turns.
  const [day, setDay] = useState(() => todayOf(Date.now()));
  useEffect(() => {
    const t = window.setTimeout(
      () => setDay(todayOf(Date.now())),
      Math.max(1000, dayBounds(day).end - Date.now()) + 50,
    );
    return () => window.clearTimeout(t);
  }, [day]);
  const today = useQuery(api.meals.day, { today: day });
  const week = useQuery(api.meals.week, { today: day });
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState("");

  const groups: Groups = today?.groups ?? { grain: 0, dal: 0, vegetable: 0, dairy: 0, fruit: 0 };
  const items = GROUPS.reduce((s, g) => s + groups[g], 0);

  return (
    <div className="flex flex-col gap-3 pb-4" data-testid="meals-room">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">
          Log how many, and when. Local dishes are welcome. The room counts food groups to show the
          balance, never a total.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone("");
            setOpen(true);
          }}
          className="flex h-11 items-center gap-2 rounded-control bg-grove px-4 text-sm font-medium text-paper"
          data-testid="meal-open"
        >
          <Plus className="size-4" aria-hidden /> Log a plate
        </button>
      </div>
      {done && (
        <Notice role="status" className="px-4 py-3 text-sm">
          {done}
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="meal-groups">
        {GROUPS.map((g) => (
          <article
            key={g}
            className={cn(
              "rounded-card border border-white/80 p-4 backdrop-blur-xl",
              GROUP_TINT[g],
            )}
          >
            <p className="text-xs text-mute">{GROUP_WORDS[g]}</p>
            <p className="font-display mt-1 text-2xl font-medium tabular-nums">
              {today ? groups[g] : "…"}
            </p>
            <p className="mt-1 text-xs text-grove">items today</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70" aria-hidden>
              <div
                className={cn("h-full rounded-full", GROUP_BAR[g])}
                style={{ width: `${items ? Math.round((groups[g] / items) * 100) : 0}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <h3 className="text-sm font-semibold">Today&rsquo;s plate</h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-36 w-36 shrink-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer={false}>
                  <Pie
                    rootTabIndex={-1}
                    data={
                      items
                        ? GROUPS.filter((g) => groups[g] > 0).map((g) => ({
                            key: g,
                            value: groups[g],
                          }))
                        : [{ key: "empty", value: 1 }]
                    }
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={58}
                    paddingAngle={items && GROUPS.filter((g) => groups[g] > 0).length > 1 ? 3 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {(items ? GROUPS.filter((g) => groups[g] > 0) : ["empty"]).map((g) => (
                      <Cell key={g} fill={GROUP_FILL[g] ?? "var(--color-sand-deep)"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="font-display text-3xl tabular-nums">{today ? items : "…"}</p>
              <p className="text-xs text-mute">{items === 1 ? "item" : "items"} today</p>
            </div>
          </div>
          <p className="mt-3 rounded-control bg-lilac/25 px-3 py-2 text-sm" data-testid="meal-line">
            {today ? plateLine(groups) : " "}
          </p>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">Today&rsquo;s meals</h3>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="meal-plates">
            {MEALS.map((m) => (
              <MealSlot key={m} meal={m} plates={today?.plates.filter((p) => p.meal === m) ?? []} />
            ))}
          </div>
          {today && today.plates.length === 0 && (
            <p className="mt-3 text-sm text-mute">Nothing logged today yet.</p>
          )}
        </Card>
      </div>

      {today && today.yesterday.length > 0 && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Yesterday</h3>
          <p className="text-xs text-mute">
            A plate logged for yesterday can still be removed here.
          </p>
          <ul className="space-y-2" data-testid="meal-plates-yesterday">
            {today.yesterday.map((p) => (
              <PlateLine key={p.plateId} plate={p} />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <WeekCard week={week} />
        <KitchenLamp week={week?.map((d) => d.groups) ?? []} />
      </div>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="bottom"
        title="Log a plate"
        className="sm:w-[min(92vw,42rem)]"
      >
        <PlateForm
          kitchen={week ? recentFoods(week) : []}
          onLogged={(n) => {
            setOpen(false);
            setDone(n === 1 ? "Logged." : `Logged. ${n} foods are on the plate.`);
          }}
        />
      </Sheet>
    </div>
  );
}

function MealSlot({ meal, plates }: { meal: (typeof MEALS)[number]; plates: PlateRow[] }) {
  const Icon = MEAL_ICON[meal];
  const first = plates.length ? Math.min(...plates.map((p) => p.eatenAt)) : null;
  const count = plates.reduce((s, p) => s + p.count, 0);
  return (
    <div className="rounded-control bg-white/80 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-mute" aria-hidden /> {MEAL_WORDS[meal]}
        <span className="ml-auto text-xs text-mute">
          {plates.length ? `${count} ${count === 1 ? "item" : "items"}` : "Empty"}
        </span>
      </p>
      {first !== null && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-grove touch:text-xs">
          <Clock className="size-3" aria-hidden /> sat at {clockOf(first)}
        </p>
      )}
      {plates.length === 0 ? (
        <p className="mt-2 text-xs text-mute">Not logged</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {plates.map((p) => (
            <PlateLine key={p.plateId} plate={p} compact />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlateLine({ plate, compact }: { plate: PlateRow; compact?: boolean }) {
  const remove = useMutation(api.meals.remove);
  const [error, setError] = useState("");
  return (
    <li className={cn("flex flex-wrap items-center gap-2", compact ? "text-xs" : "text-sm")}>
      <span className="min-w-0 flex-1">
        {compact ? "" : `${MEAL_WORDS[plate.meal]}: `}
        {plate.count} × {plate.foodName}
        <span className="text-mute">
          {" "}
          · {GROUP_WORDS[plate.group as keyof typeof GROUP_WORDS] ?? plate.group}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${plate.foodName}`}
        title="Remove"
        className="tap grid size-7 place-items-center rounded-chip text-mute hover:bg-white"
        onClick={async () => {
          try {
            await remove({ plateId: plate.plateId });
          } catch (e) {
            setError(wordFor(e));
          }
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
      {error && <span className="w-full text-xs text-danger-ink">{error}</span>}
    </li>
  );
}

type WeekDay = {
  day: string;
  groups: Groups;
  plates: { meal: string; group: string; count: number; foodName: string; eatenAt: number }[];
};

function WeekCard({ week }: { week: WeekDay[] | undefined }) {
  const data = (week ?? []).map((d) => ({ label: weekday(d.day), ...d.groups }));
  const totals = GROUPS.map(
    (g) => `${(week ?? []).reduce((s, d) => s + d.groups[g], 0)} ${GROUP_WORDS[g].toLowerCase()}`,
  );
  const dishes = week ? topDishes(week) : [];
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Plate this week</h3>
        <p className="text-xs text-mute">{week ? totals.join(" · ") : " "}</p>
      </div>
      <div className="h-40" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} accessibilityLayer={false}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-mute)" }}
              axisLine={false}
              tickLine={false}
            />
            {GROUPS.map((g, i) => (
              <Bar
                key={g}
                dataKey={g}
                stackId="m"
                fill={GROUP_FILL[g]}
                radius={i === GROUPS.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute touch:text-xs">
        {GROUPS.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", GROUP_BAR[g])} aria-hidden />
            {GROUP_WORDS[g]}
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-control bg-white/80 p-3">
        <p className="text-[11px] uppercase tracking-wide text-mute touch:text-xs">
          Usual sitting time this week
        </p>
        <p className="mt-1 text-sm" data-testid="meal-rhythm">
          {MEALS.map((m) => `${MEAL_WORDS[m]} ${week ? (usualTime(week, m) ?? "—") : "…"}`).join(
            " · ",
          )}
        </p>
        <p className="mt-1 text-[11px] text-mute touch:text-xs">
          A rhythm for the house, not a medical reading.
        </p>
      </div>
      {dishes.length > 0 && (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {dishes.map((t) => (
            <li
              key={t.name}
              className="flex justify-between rounded-chip bg-white/80 px-3 py-1.5 text-xs"
            >
              <span className="truncate">{t.name}</span>
              <span className="text-mute">× {t.times}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// The kitchen lamp: a tip for the group that came least this week first, then the others in turn on "Next lamp".
function KitchenLamp({ week }: { week: Groups[] }) {
  const [n, setN] = useState(0);
  const order = useMemo(() => lampOrder(week), [week]);
  const tip = KITCHEN_TIPS[order[n % order.length]];
  return (
    <article
      className="overflow-hidden rounded-card border border-white/80 bg-white/70 backdrop-blur-xl"
      data-testid="kitchen-lamp"
    >
      <img src={tip.image} alt="" className="h-36 w-full object-cover" />
      <div className="p-4">
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
          <Sparkles className="size-3" aria-hidden /> DHI kitchen lamp
        </p>
        <h3 className="font-display mt-1 text-xl">{tip.title}</h3>
        <p className="mt-2 text-sm text-mute">{tip.body}</p>
        <Button variant="link" className="mt-3" onClick={() => setN((x) => x + 1)}>
          Next lamp
        </Button>
      </div>
    </article>
  );
}

type Picked = { name: string; group: string; count: number };

// The one form that logs a plate: the meal, when it was eaten, and every food on it with its count. Each food is one plate on the server.
// The foods the student logged this week, most often first: the plate sheet's kitchen before any search.
function recentFoods(
  week: { plates: { foodId: string; foodName: string; group: string; count: number }[] }[],
) {
  const seen = new Map<string, { foodId: string; name: string; group: string; times: number }>();
  for (const d of week)
    for (const p of d.plates) {
      const row = seen.get(p.foodId) ?? {
        foodId: p.foodId,
        name: p.foodName,
        group: p.group,
        times: 0,
      };
      row.times += p.count;
      seen.set(p.foodId, row);
    }
  return [...seen.values()]
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    .slice(0, 9);
}

function PlateForm({
  kitchen,
  onLogged,
}: {
  kitchen: { foodId: string; name: string; group: string }[];
  onLogged: (n: number) => void;
}) {
  const log = useMutation(api.meals.log);
  const [meal, setMeal] = useState<string>(() => {
    const h = new Date().getHours();
    return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner";
  });
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [time, setTime] = useState(clockNow);
  const [text, setText] = useState("");
  const found = useQuery(api.foods.search, text.trim().length > 0 ? { text } : "skip");
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [custom, setCustom] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const chosen = Object.entries(picked).filter(([, p]) => p.count > 0);
  const step = (id: string, food: { name: string; group: string }, by: number) =>
    setPicked((x) => ({
      ...x,
      [id]: { ...food, count: Math.min(MAX_COUNT, Math.max(0, (x[id]?.count ?? 0) + by)) },
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (chosen.length === 0) return setError("Pick a food first.");
    const base = when === "today" ? Date.now() : Date.now() - 24 * 60 * 60 * 1000;
    const eatenAt = new Date(`${localDate(base)}T${time}`).getTime();
    setBusy(true);
    let n = 0;
    try {
      for (const [foodId, p] of chosen) {
        const r = await log({ foodId: foodId as never, count: p.count, meal, eatenAt });
        if (!r.ok) {
          setError(WORDS[r.code] ?? "The plate was not saved.");
          break;
        }
        n += 1;
        setPicked((x) => ({ ...x, [foodId]: { ...p, count: 0 } }));
      }
      if (n === chosen.length) onLogged(n);
    } catch (err) {
      setError(wordFor(err));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="meal-log">
      <p className="text-xs text-mute">
        How many. What time. Your own dish if it is not in the house kitchen.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Meal">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={meal === m}
            onClick={() => setMeal(m)}
            className={cn(
              "h-10 rounded-full px-4 text-sm touch:h-11",
              meal === m ? "bg-home text-paper" : "bg-white",
            )}
          >
            {MEAL_WORDS[m]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs touch:h-11">
          <Clock className="size-3.5" aria-hidden />
          Ate at
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-transparent text-sm outline-none"
            aria-label="Time eaten"
          />
        </label>
        <select
          value={when}
          onChange={(e) => setWhen(e.target.value as "today" | "yesterday")}
          className="h-10 rounded-full bg-white px-3 text-sm touch:h-11"
          aria-label="Day eaten"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
        </select>
      </div>

      <label className="block text-sm">
        Find a food (English or Hindi)
        <input
          className="mt-1 h-11 w-full rounded-control border border-home/15 bg-white/80 px-3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="roti, dal, poha, dahi…"
        />
      </label>
      {text.trim().length > 0 && found && found.length === 0 && (
        <p className="text-sm text-mute">No food found. Add it below as your own dish.</p>
      )}
      {text.trim().length === 0 && kitchen.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
            Your kitchen this week
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="meal-kitchen">
            {kitchen.map((f) => (
              <Counter
                key={f.foodId}
                name={f.name}
                sub={GROUP_WORDS[f.group as keyof typeof GROUP_WORDS] ?? f.group}
                count={picked[f.foodId]?.count ?? 0}
                onStep={(by) => step(f.foodId, { name: f.name, group: f.group }, by)}
              />
            ))}
          </div>
        </div>
      )}
      {found && found.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="meal-found">
          {found.map((f) => (
            <Counter
              key={f.foodId}
              name={f.nameEn}
              sub={`${f.serving} · ${GROUP_WORDS[f.group as keyof typeof GROUP_WORDS] ?? f.group}`}
              count={picked[f.foodId]?.count ?? 0}
              onStep={(by) => step(f.foodId, { name: f.nameEn, group: f.group }, by)}
            />
          ))}
        </div>
      )}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="On the plate">
          {chosen.map(([id, p]) => (
            <li key={id} className="rounded-full bg-mint/50 px-3 py-1">
              {p.count} × {p.name}
            </li>
          ))}
        </ul>
      )}

      {custom ? (
        <CustomDish
          startName={text.trim()}
          onClose={() => setCustom(false)}
          onSaved={(id, name, group) => {
            setCustom(false);
            setSaved(
              `Your dish is saved. It counts for its group now, and one ${name} is on the plate.`,
            );
            step(id, { name, group }, 1);
          }}
        />
      ) : (
        <Button variant="quiet" className="self-start" onClick={() => setCustom(true)}>
          Add a dish that is not listed
        </Button>
      )}

      {saved && (
        <Notice role="status" className="px-4 py-3 text-sm">
          {saved}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-home/5 pt-3">
        <p className="text-xs text-mute">
          {plural(chosen.reduce((s, [, p]) => s + p.count, 0), "item")} · {MEAL_WORDS[meal]} ·{" "}
          {when === "today" ? "today" : "yesterday"} {time}
        </p>
        <Button type="submit" disabled={busy || chosen.length === 0}>
          {busy ? "Logging…" : "Log it"}
        </Button>
      </div>
    </form>
  );
}

function Counter({
  name,
  sub,
  count,
  onStep,
}: {
  name: string;
  sub: string;
  count: number;
  onStep: (by: number) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-control border p-3",
        count ? "border-grove bg-mint/40" : "border-transparent bg-white",
      )}
    >
      <p className="text-sm font-medium">{name}</p>
      <p className="text-[11px] text-mute touch:text-xs">{sub}</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={`One less ${name}`}
          className="grid size-8 place-items-center rounded-chip bg-white text-sm touch:size-11"
          onClick={() => onStep(-1)}
          disabled={count === 0}
        >
          −
        </button>
        <span className="min-w-8 text-center text-sm tabular-nums">{count}</span>
        <button
          type="button"
          aria-label={`One more ${name}`}
          className="grid size-8 place-items-center rounded-chip bg-white text-sm touch:size-11"
          onClick={() => onStep(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

// A dish the house kitchen does not list. The group and the serving are needed so it counts; the numbers are optional and stay the student's own
// until the DHI team checks and publishes the dish.
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

// What the student searched for is the likely name of the dish they could not find, so the form starts with it.
function CustomDish({
  startName,
  onClose,
  onSaved,
}: {
  startName: string;
  onClose: () => void;
  onSaved: (id: string, name: string, group: string) => void;
}) {
  const add = useMutation(api.foods.addCustom);
  const [f, setF] = useState({
    nameEn: startName.slice(0, 60),
    nameHi: "",
    group: FOOD_GROUPS[0] as string,
    processing: PROCESSING[0] as string,
    serving: "",
    energyKcal: 0,
    carbsG: 0,
    proteinG: 0,
    fatG: 0,
  });
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      const id = await add({ ...f, nameHi: f.nameHi || undefined });
      onSaved(id, f.nameEn.trim(), f.group);
    } catch (err) {
      setError(wordFor(err));
    }
  }

  const field = "mt-1 h-11 w-full rounded-control bg-paper px-3 text-sm outline-none";
  return (
    <div
      className="grid gap-3 rounded-control bg-white p-3 sm:grid-cols-2"
      data-testid="custom-dish"
    >
      <p className="text-xs font-medium sm:col-span-2">
        Not in the list? Write the dish (uttapam, aite, home sabzi…)
      </p>
      <label className="block text-sm">
        Name
        <input
          className={field}
          value={f.nameEn}
          onChange={(e) => setF({ ...f, nameEn: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Name in Hindi (optional)
        <input
          className={field}
          value={f.nameHi}
          onChange={(e) => setF({ ...f, nameHi: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Food group
        <select
          className={field}
          value={f.group}
          onChange={(e) => setF({ ...f, group: e.target.value })}
        >
          {FOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_WORDS[g]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Serving (for example, 1 bowl)
        <input
          className={field}
          value={f.serving}
          onChange={(e) => setF({ ...f, serving: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Processing
        <select
          className={field}
          value={f.processing}
          onChange={(e) => setF({ ...f, processing: e.target.value })}
        >
          {PROCESSING.map((p) => (
            <option key={p} value={p}>
              {PROCESS_WORDS[p]}
            </option>
          ))}
        </select>
      </label>
      <details className="text-sm sm:col-span-2">
        <summary className="cursor-pointer text-xs text-mute">
          The numbers for one serving, if you know them
        </summary>
        <p className="mt-1 text-xs text-mute">
          They are yours and are never shown as a total. DHI checks and publishes the dish later.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          {(["energyKcal", "carbsG", "proteinG", "fatG"] as const).map((k) => (
            <label key={k} className="block text-sm">
              {k === "energyKcal"
                ? "Energy (kcal)"
                : k === "carbsG"
                  ? "Carbs (g)"
                  : k === "proteinG"
                    ? "Protein (g)"
                    : "Fat (g)"}
              <input
                type="number"
                min={0}
                step="any"
                className={field}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </details>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm sm:col-span-2">
          {error}
        </Notice>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button onClick={() => void save()}>Save dish</Button>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
