import { useEffect, useMemo, useState } from "react";
import { Clock, Moon, Plus, Sparkles, Sunrise, Sun, Trash2, UtensilsCrossed } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, XAxis } from "recharts";
import {
  GOAL,
  KITCHEN,
  TIPS,
  UNITS,
  clearSlot,
  clockNow,
  confirmPlate,
  dayOf,
  eatenStamp,
  formatClock,
  itemsOf,
  loadStore,
  mindLine,
  sumItems,
  todayKey,
  weekMatrix,
  weekRhythm,
  weekTop,
  type DayPlates,
  type DraftLine,
  type MealStore,
  type Slot,
  type Unit,
} from "@/lib/dhi/meals-demo";
import { Sheet } from "@/components/dhi/sheet";
import { Card } from "@/components/dhi/ui/card";
import { cn } from "@/lib/utils";

const SLOT_UI: { id: Slot; label: string; icon: typeof Sun }[] = [
  { id: "breakfast", label: "Breakfast", icon: Sunrise },
  { id: "lunch", label: "Lunch", icon: Sun },
  { id: "dinner", label: "Dinner", icon: Moon },
  { id: "snack", label: "Snacks", icon: UtensilsCrossed },
];

export function MealTracker() {
  const [store, setStore] = useState<MealStore>({ studentId: "", days: {}, memory: {}, pendingLookup: [] });
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  const today = dayOf(store);
  const sum = useMemo(() => sumItems(itemsOf(today)), [today]);
  const week = useMemo(() => weekMatrix(store), [store]);
  const top = useMemo(() => weekTop(store), [store]);
  const rhythm = useMemo(() => weekRhythm(store), [store]);
  const weekSum = useMemo(
    () => week.reduce((a, d) => ({ kcal: a.kcal + d.kcal, carbs: a.carbs + d.carbs, protein: a.protein + d.protein, fat: a.fat + d.fat }), { kcal: 0, carbs: 0, protein: 0, fat: 0 }),
    [week],
  );

  const pie = [
    { key: "Anna", value: Math.round(sum.carbs), fill: "var(--color-gold)" },
    { key: "Dal", value: Math.round(sum.protein), fill: "var(--color-lilac)" },
    { key: "Sneha", value: Math.round(sum.fat), fill: "var(--color-peach)" },
  ];
  const news = TIPS[tip % TIPS.length];

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">
          Log how many, and when. Local dishes are welcome — DHI will fill calories later. We watch rhythm, not illness.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-2 rounded-control bg-grove px-4 text-sm font-medium text-paper"
        >
          <Plus className="size-4" /> Log a plate
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Calories today" value={`${Math.round(sum.kcal)}`} note={sum.pending ? `+ ${sum.pending} waiting on DHI` : `/ ${GOAL.kcal} kcal`} fill={sum.kcal / GOAL.kcal} tone="peach" />
        <Stat label="Anna · carbs" value={`${Math.round(sum.carbs)} g`} note={`/ ${GOAL.carbs} g`} fill={sum.carbs / GOAL.carbs} tone="gold" />
        <Stat label="Dal · protein" value={`${Math.round(sum.protein)} g`} note={`/ ${GOAL.protein} g`} fill={sum.protein / GOAL.protein} tone="lilac" />
        <Stat label="Sneha · fats" value={`${Math.round(sum.fat)} g`} note={`/ ${GOAL.fat} g`} fill={sum.fat / GOAL.fat} tone="mint" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <h3 className="text-sm font-semibold">Today’s plate</h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={42} outerRadius={58} paddingAngle={3} stroke="none" isAnimationActive={false}>
                    {pie.map((s) => (
                      <Cell key={s.key} fill={s.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="font-display text-3xl">{Math.round(sum.kcal)}</p>
              <p className="text-xs text-mute">known kcal · {todayKey()}</p>
            </div>
          </div>
          <p className="mt-3 rounded-control bg-lilac/25 px-3 py-2 text-sm">
            {itemsOf(today).length === 0 ? "No plate yet today. Log when you have eaten." : mindLine(sum.guna)}
          </p>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">Today’s meals</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {SLOT_UI.map((s) => {
              const Icon = s.icon;
              const plate = today[s.id];
              const kcal = Math.round(sumItems(plate.items).kcal);
              const clock = formatClock(plate.eatenAt);
              return (
                <div key={s.id} className="rounded-control bg-white/80 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-mute" /> {s.label}
                    <span className="ml-auto text-xs text-mute">{plate.items.length ? (kcal ? `${kcal} kcal` : "DHI pending") : "Empty"}</span>
                    {plate.items.length > 0 && (
                      <button
                        type="button"
                        className="text-mute touch:-my-3 touch:-mr-2 touch:grid touch:size-11 touch:place-items-center"
                        aria-label={`Clear ${s.label}`}
                        onClick={() => setStore(clearSlot(store, s.id))}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </p>
                  {clock && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-grove touch:text-xs">
                      <Clock className="size-3" /> sat at {clock}
                    </p>
                  )}
                  {plate.items.length === 0 ? (
                    <p className="mt-2 text-xs text-mute">Not logged</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs">
                      {plate.items.map((l) => (
                        <li key={l.id}>
                          {l.qty} {l.unit} {l.name}
                          {l.pending ? " · DHI will fill kcal" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Plate this week</h3>
            <p className="text-xs text-mute">
              {weekSum.kcal} kcal · {weekSum.carbs}g anna · {weekSum.protein}g dal · {weekSum.fat}g sneha
            </p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} barGap={2}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-mute)" }} axisLine={false} tickLine={false} />
                <Bar dataKey="carbs" stackId="m" fill="var(--color-gold)" />
                <Bar dataKey="protein" stackId="m" fill="var(--color-lilac)" />
                <Bar dataKey="fat" stackId="m" fill="var(--color-peach)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 rounded-control bg-white/80 p-3">
            <p className="text-[11px] uppercase tracking-wide text-mute touch:text-xs">Usual sitting time this week</p>
            <p className="mt-1 text-sm">
              Breakfast {rhythm.breakfast ?? "—"} · Lunch {rhythm.lunch ?? "—"} · Dinner {rhythm.dinner ?? "—"} · Snacks {rhythm.snack ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-mute touch:text-xs">A rhythm for the house — not a medical reading.</p>
          </div>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {top.map((t) => (
              <li key={t.name} className="flex justify-between rounded-chip bg-white/80 px-3 py-1.5 text-xs">
                <span>{t.name}</span>
                <span className="text-mute">{t.pending ? "pending" : `${Math.round(t.kcal)} kcal`}</span>
              </li>
            ))}
          </ul>
        </Card>

        <article className="overflow-hidden rounded-card border border-white/80 bg-white/70 backdrop-blur-xl">
          <img src={news.image} alt="" className="h-36 w-full object-cover" />
          <div className="p-4">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
              <Sparkles className="size-3" /> DHI kitchen lamp
            </p>
            <h3 className="font-display mt-1 text-xl">{news.title}</h3>
            <p className="mt-2 text-sm text-mute">{news.body}</p>
            <button
              type="button"
              onClick={() => setTip((n) => n + 1)}
              className="tap mt-3 text-xs text-grove touch:-ml-3 touch:inline-flex touch:items-center touch:justify-center touch:px-3"
            >
              Next lamp
            </button>
          </div>
        </article>
      </div>

      {open && (
        <PlateDialog
          today={today}
          onClose={() => setOpen(false)}
          onConfirm={(slot, draft, time) => {
            setStore(confirmPlate(store, slot, draft, eatenStamp(time)));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PlateDialog({
  today,
  onClose,
  onConfirm,
}: {
  today: DayPlates;
  onClose: () => void;
  onConfirm: (slot: Slot, draft: DraftLine[], time: string) => void;
}) {
  const [slot, setSlot] = useState<Slot>("breakfast");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [customs, setCustoms] = useState<{ name: string; unit: Unit; qty: number }[]>([]);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<Unit>("piece");
  const [customQty, setCustomQty] = useState(1);
  const [time, setTime] = useState(clockNow);

  useEffect(() => {
    const start: Record<string, number> = {};
    for (const item of today[slot].items) {
      if (item.pending) continue;
      start[item.foodId] = (start[item.foodId] ?? 0) + item.qty;
    }
    setQty(start);
    setCustoms(today[slot].items.filter((i) => i.pending).map((i) => ({ name: i.name, unit: i.unit, qty: i.qty })));
    setTime(formatClock(today[slot].eatenAt) ?? clockNow());
  }, [slot, today]);

  const draft: DraftLine[] = [
    ...Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([foodId, n]) => ({ foodId, qty: n, unit: KITCHEN.find((k) => k.id === foodId)!.unit })),
    ...customs.map((c) => ({ customName: c.name, unit: c.unit, qty: c.qty })),
  ];

  const known = draft
    .filter((d) => d.foodId)
    .map((d) => {
      const f = KITCHEN.find((k) => k.id === d.foodId)!;
      return {
        id: f.id,
        foodId: f.id,
        name: f.name,
        unit: f.unit,
        qty: d.qty,
        kcal: f.kcal * d.qty,
        carbs: f.carbs * d.qty,
        protein: f.protein * d.qty,
        fat: f.fat * d.qty,
        guna: f.guna,
        pending: false,
      };
    });
  const live = sumItems(known);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} side="bottom" title="Log a plate" className="sm:w-[min(92vw,42rem)]">
      <p className="text-xs text-mute">How many. What time. Your own dish if it is not in the house kitchen.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SLOT_UI.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlot(s.id)}
            className={cn("h-10 rounded-full px-4 text-sm touch:h-11", slot === s.id ? "bg-home text-paper" : "bg-white")}
          >
            {s.label}
          </button>
        ))}
        <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs touch:h-11 sm:ml-auto">
          <Clock className="size-3.5" aria-hidden />
          Ate at
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-sm outline-none" />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {KITCHEN.map((k) => {
          const n = qty[k.id] ?? 0;
          return (
            <div
              key={k.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-control border p-3 min-[420px]:block",
                n ? "border-grove bg-mint/40" : "border-transparent bg-white",
              )}
            >
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-[11px] text-mute touch:text-xs">
                  1 {k.unit} · {k.kcal} kcal
                </p>
              </div>
              <div className="flex items-center gap-2 min-[420px]:mt-2">
                <button
                  type="button"
                  aria-label={`Less ${k.name}`}
                  className="grid size-8 place-items-center rounded-chip bg-white text-sm touch:size-11"
                  onClick={() => setQty((q) => ({ ...q, [k.id]: Math.max(0, (q[k.id] ?? 0) - 1) }))}
                >
                  −
                </button>
                <span className="min-w-8 text-center text-sm tabular-nums">
                  {n} {k.unit}
                </span>
                <button
                  type="button"
                  aria-label={`More ${k.name}`}
                  className="grid size-8 place-items-center rounded-chip bg-white text-sm touch:size-11"
                  onClick={() => setQty((q) => ({ ...q, [k.id]: (q[k.id] ?? 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-control bg-white p-3">
        <p className="text-xs font-medium">Not in the list? Write the dish (uttapam, aite, home sabzi…)</p>
        <p className="mt-1 text-[11px] text-mute touch:text-xs">Calories wait. DHI searches later and updates the tracker. The name is remembered.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name of the dish"
            className="h-11 min-w-40 flex-1 rounded-control bg-paper px-3 text-sm outline-none"
          />
          <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as Unit)} className="h-11 rounded-control bg-paper px-3 text-sm">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="flex h-11 items-center gap-1 rounded-control bg-paper px-2">
            <button type="button" aria-label="Fewer" className="grid size-8 place-items-center touch:size-11" onClick={() => setCustomQty((n) => Math.max(1, n - 1))}>
              −
            </button>
            <span className="w-6 text-center text-sm">{customQty}</span>
            <button type="button" aria-label="More" className="grid size-8 place-items-center touch:size-11" onClick={() => setCustomQty((n) => n + 1)}>
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!customName.trim()}
            onClick={() => {
              setCustoms((c) => [...c, { name: customName.trim(), unit: customUnit, qty: customQty }]);
              setCustomName("");
              setCustomQty(1);
            }}
            className="h-11 rounded-control bg-home px-4 text-sm text-paper disabled:opacity-40"
          >
            Add dish
          </button>
        </div>
        {customs.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {customs.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-2">
                <span>
                  {c.qty} {c.unit} {c.name} · DHI will fill kcal
                </span>
                <button type="button" className="tap touch:inline-flex touch:items-center touch:justify-center touch:px-2" onClick={() => setCustoms((x) => x.filter((_, j) => j !== i))}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky -bottom-5 -mx-5 -mb-5 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-home/5 bg-page px-5 py-4">
        <p className="text-xs text-mute">
          {Math.round(live.kcal)} kcal known · {customs.length} waiting on DHI · {time}
        </p>
        <button
          type="button"
          disabled={draft.length === 0}
          onClick={() => onConfirm(slot, draft, time)}
          className="h-11 rounded-control bg-grove px-5 text-sm font-medium text-paper disabled:opacity-40"
        >
          Confirm {SLOT_UI.find((s) => s.id === slot)?.label}
        </button>
      </div>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  note,
  fill,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  fill: number;
  tone: "peach" | "gold" | "lilac" | "mint";
}) {
  const bg = { peach: "bg-peach/40", gold: "bg-gold/40", lilac: "bg-lilac/35", mint: "bg-mint/40" }[tone];
  const bar = { peach: "bg-danger", gold: "bg-gold", lilac: "bg-lilac", mint: "bg-grove" }[tone];
  return (
    <article className={cn("rounded-card border border-white/80 p-4 backdrop-blur-xl", bg)}>
      <p className="text-xs text-mute">{label}</p>
      <p className="font-display mt-1 text-2xl font-medium">{value}</p>
      <p className="text-xs text-grove">{note}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, fill * 100)}%` }} />
      </div>
    </article>
  );
}
