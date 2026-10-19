/**
 * Create a habit. Name is always writable. Suggestions are shortcuts.
 * Colour is chosen from the house palette (psychology, not decoration).
 */
import { useEffect, useState } from "react";
import { MAX_WINDOW_DAYS, START_AHEAD_DAYS } from "@dhi/backend/habitCodes";
import { isDayKey } from "@dhi/backend/dayRules";
import { CATALOG, MAX_HABITS, PALETTE, addDays } from "@/lib/dhi/habits";
import { Sheet } from "@/components/dhi/sheet";
import { cn } from "@/lib/utils";

export function HabitCompose({
  remaining,
  today,
  onClose,
  onSave,
}: {
  remaining: number;
  today: string;
  onClose: () => void;
  // Resolves to a plain line when the server refuses (the form stays open and shows it), or to null when the habit was made.
  onSave: (title: string, startOn: string, endOn: string, catalogId: string | null, color: string) => Promise<string | null>;
}) {
  const [title, setTitle] = useState("");
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(PALETTE[0].hex);
  // The window the server accepts: a start from today to 14 days ahead, and an end up to 89 days after the start.
  const [startOn, setStartOn] = useState(today);
  const [endOn, setEndOn] = useState(addDays(today, 20));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  // If the form stays open across 04:00, a start from the old day would be refused, so it moves up to today.
  useEffect(() => {
    setStartOn((s) => (isDayKey(s) && s < today ? today : s));
  }, [today]);
  // The window as the server checks it. The date boxes can hold a cleared or half typed date, so nothing is worked out from one that is not a real day.
  const startOk = isDayKey(startOn) && startOn >= today && startOn <= addDays(today, START_AHEAD_DAYS);
  const endMax = isDayKey(startOn) ? addDays(startOn, MAX_WINDOW_DAYS - 1) : undefined;
  const endOk = startOk && isDayKey(endOn) && endOn >= startOn && endOn <= (endMax as string);

  function pick(id: string) {
    const c = CATALOG.find((x) => x.id === id);
    if (!c) return;
    setCatalogId(c.id);
    setTitle(c.title);
    setColor(c.color);
  }

  const chosen = PALETTE.find((x) => x.hex === color);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} side="bottom" title="New habit">
      <p className="text-xs text-mute">
        {remaining} of {MAX_HABITS} left. Name it. Colour it. Give it a window.
      </p>

      <label className="mt-4 block text-xs text-mute">
        Your habit
        <input
          value={title}
          maxLength={40}
          data-testid="habit-title"
          onChange={(e) => {
            setTitle(e.target.value);
            setCatalogId(null);
          }}
          placeholder="Write it — drink water, stretch, no scroll after 10…"
          className="mt-1 h-12 w-full rounded-control bg-white px-4 text-sm text-home outline-none"
        />
      </label>

      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">Or pick a start</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATALOG.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            className={cn("rounded-full px-3 py-1.5 text-xs touch:min-h-11 touch:px-4", catalogId === c.id ? "text-paper" : "bg-white")}
            style={{ backgroundColor: catalogId === c.id ? c.color : undefined }}
          >
            {c.glyph} {c.title}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">Colour</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PALETTE.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setColor(p.hex)}
            title={`${p.name} · ${p.feel}`}
            aria-label={`${p.name} · ${p.feel}`}
            aria-pressed={color === p.hex}
            className={cn("size-8 rounded-full ring-offset-2 touch:size-11", color === p.hex && "ring-2 ring-home")}
            style={{ backgroundColor: p.hex }}
          />
        ))}
      </div>
      {chosen && (
        <p className="mt-2 hidden text-xs text-mute touch:block">
          {chosen.name} · {chosen.feel}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-mute">
          Starts
          <input type="date" value={startOn} min={today} max={addDays(today, START_AHEAD_DAYS)} onChange={(e) => setStartOn(e.target.value)} className="mt-1 h-11 w-full rounded-control bg-white px-3 text-sm text-home" />
        </label>
        <label className="text-xs text-mute">
          Ends
          <input type="date" value={endOn} min={startOn} max={endMax} onChange={(e) => setEndOn(e.target.value)} className="mt-1 h-11 w-full rounded-control bg-white px-3 text-sm text-home" />
        </label>
      </div>

      {problem && (
        <p role="alert" data-testid="habit-compose-error" className="mt-4 rounded-control bg-peach px-4 py-3 text-sm text-ink">
          {problem}
        </p>
      )}
      <button
        type="button"
        disabled={!title.trim() || remaining <= 0 || !startOk || !endOk || saving}
        data-testid="habit-create"
        onClick={async () => {
          setSaving(true);
          setProblem("");
          const line = await onSave(title.trim(), startOn, endOn, catalogId, color);
          if (line) setProblem(line);
          setSaving(false);
        }}
        className="mt-5 h-12 w-full rounded-full text-sm font-medium text-paper disabled:opacity-40"
        style={{ backgroundColor: color }}
      >
        {saving ? "Saving…" : "Create habit"}
      </button>
    </Sheet>
  );
}
