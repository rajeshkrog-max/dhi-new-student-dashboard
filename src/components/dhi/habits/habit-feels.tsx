// The weekly habit feels check (the Master Spec's H10; house spec 0030). Once a week for each open habit: four lines, each 1 to 7, about how automatic
// the habit feels. The answer is the student's own and only feeds their Progress page; it is never a score of the student.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { FEELS_DONE, FEELS_HABIT, FEELS_ITEMS, FEELS_NOTE, FEELS_SAVE, FEELS_SCALE, FEELS_TITLE, habitRefusal } from "@/lib/dhi/habits/words";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";

const SCALE = [1, 2, 3, 4, 5, 6, 7];

export function HabitFeels({ habits }: { habits: { id: string; title: string }[] }) {
  // The week is picked by the screen's clock (a query does not read one); it only chooses which week's answers to read.
  const [now] = useState(() => Date.now());
  const rated = useQuery(api.habits.ratedThisWeek, { now });
  const rate = useMutation(api.habits.rate);
  const [pick, setPick] = useState("");
  const [items, setItems] = useState<(number | null)[]>([null, null, null, null]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  if (rated === undefined) return null;
  const left = habits.filter((h) => !rated.includes(h.id));
  if (left.length === 0 && !saved) return null;
  const habit = left.find((h) => h.id === pick) ?? left[0];

  async function save() {
    if (!habit || items.some((x) => x === null)) return;
    setNote("");
    try {
      const r = await rate({ planId: habit.id, items: items as number[] });
      if (!r.ok) setNote(habitRefusal(r.code));
      else {
        setSaved(true);
        setItems([null, null, null, null]);
        setPick("");
      }
    } catch (error) {
      setNote(habitRefusal(error));
    }
  }

  return (
    <section className="space-y-3 rounded-card border border-white/80 bg-white/70 p-4 shadow-sm sm:p-6" data-testid="habit-feels">
      <h2 className="text-base font-semibold">{FEELS_TITLE}</h2>
      <p className="text-xs text-mute touch:text-sm">{FEELS_NOTE}</p>
      {saved && (
        <Notice role="status" className="px-4 py-3 text-sm" data-testid="habit-feels-done">
          {FEELS_DONE}
        </Notice>
      )}
      {habit && (
        <>
          {left.length > 1 && (
            <label className="block">
              <span className="mb-2 block text-xs text-ink/70">{FEELS_HABIT}</span>
              <select value={habit.id} onChange={(e) => setPick(e.target.value)} className="w-full rounded-control border border-white/80 bg-white/60 p-3 text-sm focus-visible:focus-ring" data-testid="habit-feels-pick">
                {left.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {left.length === 1 && <p className="text-sm font-medium">{habit.title}</p>}
          <p className="text-xs text-mute touch:text-sm">{FEELS_SCALE}</p>
          {FEELS_ITEMS.map((line, i) => (
            <fieldset key={line} className="space-y-2">
              <legend className="text-sm">{line}</legend>
              <div className="flex flex-wrap gap-1">
                {SCALE.map((n) => (
                  <label key={n} className="tap grid size-11 cursor-pointer place-items-center rounded-control border border-home/15 bg-white/70 text-sm has-[:checked]:bg-grove has-[:checked]:text-paper">
                    <input
                      type="radio"
                      name={`feel-${i}`}
                      className="sr-only"
                      checked={items[i] === n}
                      onChange={() => setItems((xs) => xs.map((x, k) => (k === i ? n : x)))}
                      data-testid={`habit-feels-${i}-${n}`}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <Button onClick={() => void save()} disabled={items.some((x) => x === null)} data-testid="habit-feels-save">
            {FEELS_SAVE}
          </Button>
        </>
      )}
      {note && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {note}
        </Notice>
      )}
    </section>
  );
}
