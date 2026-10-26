// The meals room (spec house/0010, house/0009). A student logs a plate: a food from the catalog or their own custom dish, a count, the meal and the
// time eaten. The day shows how many items came from each food group, never a calorie total or a target. A student can add a custom dish with
// the numbers they know (per serving). Removing a plate voids it. The week shows the group counts of the last seven days.
import { useState, type FormEvent } from "react";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { FOOD_GROUPS, MEALS, PROCESSING } from "@dhi/backend/foodRules";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

const GROUP_WORDS: Record<string, string> = { grain: "Grain", dal: "Dal or protein", vegetable: "Vegetable", dairy: "Dairy", fruit: "Fruit" };
const MEAL_WORDS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const PROCESS_WORDS: Record<string, string> = { home_cooked: "Home cooked", packaged: "Packaged", fried: "Fried" };
const WORDS: Record<string, string> = {
  rate_limited: "That was too many taps for now. Please wait a little.",
  bad_count: "Please pick a count from 1 to 20.",
  bad_meal: "Please pick a meal.",
  bad_time: "That time is not allowed. A meal can be logged up to a day back, and not in the future.",
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
const timeInput = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function MealsRoom() {
  const today = useQuery(api.meals.day, {});
  const week = useQuery(api.meals.week, {});
  return (
    <div className="space-y-4" data-testid="meals-room">
      <LogPlate />
      <CustomDish />
      {today && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Today</h2>
          <p className="text-xs text-mute">Items from each food group. A quick look at the balance, not a total.</p>
          <GroupRow groups={today.groups} />
          <ul className="space-y-2" data-testid="meal-plates">
            {today.plates.map((p) => (
              <PlateRow key={p.plateId} plate={p} />
            ))}
          </ul>
          {today.plates.length === 0 && <p className="text-sm text-mute">Nothing logged today yet.</p>}
        </Card>
      )}
      {week && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">The last seven days</h2>
          {week.map((d) => (
            <div key={d.day} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-mute">{d.day}</span>
              <GroupRow groups={d.groups} compact />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function GroupRow({ groups, compact }: { groups: Record<string, number>; compact?: boolean }) {
  return (
    <div className={compact ? "flex flex-wrap gap-2 text-xs" : "flex flex-wrap gap-2 text-sm"}>
      {FOOD_GROUPS.map((g) => (
        <span key={g} className="rounded-control border border-home/15 bg-white/80 px-2 py-1">
          {GROUP_WORDS[g]} {groups[g] ?? 0}
        </span>
      ))}
    </div>
  );
}

function PlateRow({ plate }: { plate: { plateId: GenericId<"mealPlates">; meal: string; group: string; count: number; foodName: string; eatenAt: number } }) {
  const remove = useMutation(api.meals.remove);
  const [error, setError] = useState("");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>
        {MEAL_WORDS[plate.meal]}: {plate.foodName} × {plate.count}
      </span>
      <Button
        variant="quiet"
        onClick={async () => {
          try {
            await remove({ plateId: plate.plateId });
          } catch (e) {
            setError(wordFor(e));
          }
        }}
      >
        Remove
      </Button>
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </li>
  );
}

function LogPlate() {
  const log = useMutation(api.meals.log);
  const [text, setText] = useState("");
  const found = useQuery(api.foods.search, text.trim().length > 0 ? { text } : "skip");
  const [foodId, setFoodId] = useState("");
  const [count, setCount] = useState(1);
  const [meal, setMeal] = useState<string>(MEALS[1]);
  const [eatenAt, setEatenAt] = useState(() => timeInput(Date.now()));
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!foodId) return setError("Pick a food first.");
    try {
      const r = await log({ foodId: foodId as never, count, meal, eatenAt: new Date(eatenAt).getTime() });
      if (!r.ok) setError(WORDS[r.code] ?? "The plate was not saved.");
      else {
        setDone("Logged.");
        setText("");
        setFoodId("");
        setCount(1);
      }
    } catch (err) {
      setError(wordFor(err));
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3" data-testid="meal-log">
        <h2 className="text-sm font-semibold">Log a plate</h2>
        <label className="block text-sm">
          Find a food (English or Hindi)
          <input className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {found && found.length > 0 && (
          <select className="w-full rounded-control border border-home/15 bg-white/80 px-3 py-2 text-sm" value={foodId} onChange={(e) => setFoodId(e.target.value)} aria-label="Food">
            <option value="">Choose a food</option>
            {found.map((f) => (
              <option key={f.foodId} value={f.foodId}>
                {f.nameEn} ({GROUP_WORDS[f.group]}, {PROCESS_WORDS[f.processing]})
              </option>
            ))}
          </select>
        )}
        {text.trim().length > 0 && found && found.length === 0 && <p className="text-sm text-mute">No food found. Add it below as your own dish.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            Count
            <input type="number" min={1} max={20} className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            Meal
            <select className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_WORDS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Time eaten
            <input type="datetime-local" className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
          </label>
        </div>
        {error && (
          <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
        {done && (
          <Notice role="status" className="px-4 py-3 text-sm">
            {done}
          </Notice>
        )}
        <Button type="submit">Log it</Button>
      </form>
    </Card>
  );
}

function CustomDish() {
  const add = useMutation(api.foods.addCustom);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nameEn: "", nameHi: "", group: FOOD_GROUPS[0] as string, processing: PROCESSING[0] as string, serving: "", energyKcal: 0, carbsG: 0, proteinG: 0, fatG: 0 });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    try {
      await add({ ...f, nameHi: f.nameHi || undefined });
      setDone("Your dish is saved. It counts for its group now.");
      setOpen(false);
    } catch (err) {
      setError(wordFor(err));
    }
  }

  if (!open)
    return (
      <div className="space-y-2">
        {done && (
          <Notice role="status" className="px-4 py-3 text-sm">
            {done}
          </Notice>
        )}
        <Button variant="quiet" onClick={() => { setDone(""); setOpen(true); }}>
          Add a dish that is not listed
        </Button>
      </div>
    );
  return (
    <Card>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2" data-testid="custom-dish">
        <h2 className="text-sm font-semibold sm:col-span-2">Your own dish</h2>
        <label className="block text-sm">
          Name
          <input className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} required />
        </label>
        <label className="block text-sm">
          Name in Hindi (optional)
          <input className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f.nameHi} onChange={(e) => setF({ ...f, nameHi: e.target.value })} />
        </label>
        <label className="block text-sm">
          Food group
          <select className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            {FOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {GROUP_WORDS[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Processing
          <select className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f.processing} onChange={(e) => setF({ ...f, processing: e.target.value })}>
            {PROCESSING.map((p) => (
              <option key={p} value={p}>
                {PROCESS_WORDS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          Serving (for example, 1 bowl)
          <input className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f.serving} onChange={(e) => setF({ ...f, serving: e.target.value })} required />
        </label>
        <p className="text-xs text-mute sm:col-span-2">The numbers for one serving, as you know them. They are yours; DHI can check and publish the dish later.</p>
        {(["energyKcal", "carbsG", "proteinG", "fatG"] as const).map((k) => (
          <label key={k} className="block text-sm">
            {k === "energyKcal" ? "Energy (kcal)" : k === "carbsG" ? "Carbs (g)" : k === "proteinG" ? "Protein (g)" : "Fat (g)"}
            <input type="number" min={0} step="any" className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
          </label>
        ))}
        {error && (
          <Notice tone="danger" role="alert" className="px-4 py-3 text-sm sm:col-span-2">
            {error}
          </Notice>
        )}
        {done && (
          <Notice role="status" className="px-4 py-3 text-sm sm:col-span-2">
            {done}
          </Notice>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">Save dish</Button>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
