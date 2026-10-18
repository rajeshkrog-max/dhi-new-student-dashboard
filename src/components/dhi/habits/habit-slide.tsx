/**
 * Habit detail slide. Still: public/habits/grove.jpg (grove pair at dusk).
 */
import { Flag } from "lucide-react";
import { Sheet } from "@/components/dhi/sheet";
import { glyphOf, insight, isLit, nextFlag, river, tally, type HabitPlan, type HabitStore } from "@/lib/dhi/habits";
import { prettyDate } from "@/lib/dhi/mood-demo";

export function HabitSlide({
  plan,
  store,
  onClose,
  onToggle,
}: {
  plan: HabitPlan;
  store: HabitStore;
  onClose: () => void;
  onToggle: () => void;
}) {
  const t = tally(store, plan);
  const days = river(store, plan, 28);
  const flag = nextFlag(t.streak);
  const done = isLit(store, plan.id);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      side="right"
      tone="photo"
      title={plan.title}
      backdrop={
        <>
          <div className="pointer-events-none absolute inset-0 bg-cover bg-[center_45%]" style={{ backgroundImage: "url(/habits/grove.jpg)" }} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a1208]/88 via-[#1a1208]/20 to-transparent" />
        </>
      }
    >
      <div>
        <p className="w-fit rounded-full border border-white/35 bg-black/30 px-3 py-1 text-[11px] backdrop-blur-md touch:text-xs">
          {prettyDate(plan.startOn)} → {prettyDate(plan.endOn)}
        </p>
        <p className="font-display mt-3 text-4xl">
          {glyphOf(plan)} {plan.title}
        </p>
      </div>

      <div className="mt-auto space-y-3 pb-2 pt-16">
        <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 text-center backdrop-blur-xl">
          <span className="streak-fire text-4xl">🔥</span>
          <p className="font-display mt-1 text-5xl">{t.streak}</p>
          <p className="text-sm text-paper/75">day streak · personal best {t.best}</p>
          <div className="relative mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-gold" style={{ width: `${flag.fill * 100}%` }} />
            </div>
            <Flag className="absolute -top-1 size-4 text-gold" style={{ left: `calc(${Math.min(98, flag.fill * 100)}% - 8px)` }} aria-hidden />
          </div>
          <p className="mt-2 text-xs text-paper/80">Next flag: {flag.target} days · {flag.left} to go</p>
        </div>
        <div className="rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">This month</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {days.map((d) => (
              <span key={d.date} className="size-4 rounded-md" style={{ backgroundColor: d.lit ? "#e8c36a" : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">DHI</p>
          <p className="font-display mt-2 text-xl leading-snug">{insight(store, plan)}</p>
        </div>
        <button type="button" onClick={onToggle} className="lamp-glow h-12 w-full rounded-full bg-paper text-sm font-medium text-home">
          {done ? "Undo today" : "Done for today"}
        </button>
      </div>
    </Sheet>
  );
}
