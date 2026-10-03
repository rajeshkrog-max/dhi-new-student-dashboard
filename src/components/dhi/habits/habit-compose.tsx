/**
 * Create a habit. Name is always writable. Suggestions are shortcuts.
 * Colour is chosen from the house palette (psychology, not decoration).
 */
import { useState } from "react";
import { X } from "lucide-react";
import { CATALOG, MAX_HABITS, PALETTE, addDays, todayKey } from "@/lib/dhi/habits";
import { cn } from "@/lib/utils";

export function HabitCompose({
  remaining,
  onClose,
  onSave,
}: {
  remaining: number;
  onClose: () => void;
  onSave: (title: string, startOn: string, endOn: string, catalogId: string | null, color: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(PALETTE[0].hex);
  const [startOn, setStartOn] = useState(todayKey());
  const [endOn, setEndOn] = useState(addDays(todayKey(), 21));

  function pick(id: string) {
    const c = CATALOG.find((x) => x.id === id);
    if (!c) return;
    setCatalogId(c.id);
    setTitle(c.title);
    setColor(c.color);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-home/35 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[28px] bg-[#f7f1e8] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-2xl">New habit</p>
            <p className="text-xs text-mute">
              {remaining} of {MAX_HABITS} left. Name it. Colour it. Give it a window.
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-2xl bg-white" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-4 block text-xs text-mute">
          Your habit
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setCatalogId(null);
            }}
            placeholder="Write it — drink water, stretch, no scroll after 10…"
            className="mt-1 h-12 w-full rounded-2xl bg-white px-4 text-sm text-home outline-none"
          />
        </label>

        <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-mute">Or pick a start</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATALOG.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className={cn("rounded-full px-3 py-1.5 text-xs", catalogId === c.id ? "text-paper" : "bg-white")}
              style={{ backgroundColor: catalogId === c.id ? c.color : undefined }}
            >
              {c.glyph} {c.title}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-mute">Colour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALETTE.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setColor(p.hex)}
              title={`${p.name} · ${p.feel}`}
              className={cn("size-8 rounded-full ring-offset-2", color === p.hex && "ring-2 ring-home")}
              style={{ backgroundColor: p.hex }}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-mute">
            Starts
            <input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm text-home" />
          </label>
          <label className="text-xs text-mute">
            Ends
            <input type="date" value={endOn} min={startOn} onChange={(e) => setEndOn(e.target.value)} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm text-home" />
          </label>
        </div>

        <button
          type="button"
          disabled={!title.trim() || remaining <= 0 || endOn < startOn}
          onClick={() => onSave(title.trim(), startOn, endOn, catalogId, color)}
          className="mt-5 h-12 w-full rounded-full text-sm font-medium text-paper disabled:opacity-40"
          style={{ backgroundColor: color }}
        >
          Create habit
        </button>
      </div>
    </div>
  );
}
