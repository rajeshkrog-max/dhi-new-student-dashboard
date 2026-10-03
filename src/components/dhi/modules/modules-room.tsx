/**
 * Modules room. Films are house-owned. A student watches from the start.
 * Seeking past the watched point is closed until the film ends.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { MODULES, loadProgress, saveProgress, type HouseModule, type ModuleProgress } from "@/lib/dhi/modules/catalog";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Academic", "Self help", "Mental health", "Kept"] as const;

export function ModulesRoom() {
  const [progress, setProgress] = useState<ModuleProgress>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState<HouseModule | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const kept = MODULES.filter((m) => progress[m.id]?.kept);
  const score = kept.reduce((n, m) => n + m.score, 0);
  const list = MODULES.filter((m) => {
    if (filter === "All") return true;
    if (filter === "Kept") return progress[m.id]?.kept;
    return m.category === filter;
  });

  function write(next: ModuleProgress) {
    setProgress(next);
    saveProgress(next);
  }

  if (open) {
    return (
      <Player
        module={open}
        progress={progress[open.id]}
        onProgress={(row) => write({ ...progress, [open.id]: row })}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn("h-9 rounded-full px-3 text-sm", filter === f ? "bg-home text-paper" : "bg-white/70 text-home")}
          >
            {f}
            {f === "Kept" && <span className="ml-1 text-xs opacity-70">{kept.length}</span>}
          </button>
        ))}
        <article className="ml-auto flex items-center gap-4 rounded-2xl bg-white/80 px-4 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">Kept</p>
            <p className="font-display text-xl leading-none">{kept.length}/{MODULES.length}</p>
          </div>
          <div className="h-8 w-px bg-home/10" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">Score</p>
            <p className="font-display text-xl leading-none">{score}</p>
          </div>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const row = progress[m.id];
          const ratio = row?.kept ? 1 : row?.ratio ?? 0;
          return (
            <button key={m.id} type="button" onClick={() => setOpen(m)} className="overflow-hidden rounded-[24px] bg-white/80 text-left shadow-sm">
              <span className="relative block aspect-[16/10]">
                <img src={m.cover} alt="" className="size-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px]">{m.category}</span>
                {row?.kept && (
                  <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-mint text-grove">
                    <Check className="size-4" />
                  </span>
                )}
              </span>
              <span className="block px-4 py-3">
                <span className="block font-medium">{m.title}</span>
                <span className="mt-1 block text-xs text-mute">DHI house · {m.minutes}</span>
                <span className="mt-3 block h-1 overflow-hidden rounded-full bg-home/10">
                  <span className="block h-full rounded-full bg-grove" style={{ width: `${Math.round(ratio * 100)}%` }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="text-sm text-mute">Nothing kept in this tag yet.</p>}
    </div>
  );
}

function Player({
  module,
  progress,
  onProgress,
  onBack,
}: {
  module: HouseModule;
  progress?: { ratio: number; kept: boolean };
  onProgress: (row: { ratio: number; kept: boolean }) => void;
  onBack: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const max = useRef(progress?.kept ? 1 : progress?.ratio ?? 0);
  const bucket = useRef(-1);
  const [ratio, setRatio] = useState(progress?.kept ? 1 : progress?.ratio ?? 0);
  const kept = Boolean(progress?.kept) || ratio >= 0.98;

  useEffect(() => {
    max.current = progress?.kept ? 1 : progress?.ratio ?? 0;
  }, [progress]);

  function guard() {
    const video = ref.current;
    if (!video || !video.duration || progress?.kept) return;
    const allowed = max.current * video.duration + 0.75;
    if (video.currentTime > allowed) video.currentTime = allowed;
  }

  function tick() {
    const video = ref.current;
    if (!video || !video.duration) return;
    const next = Math.min(1, video.currentTime / video.duration);
    if (next > max.current) max.current = next;
    setRatio(max.current);
    const step = Math.floor(max.current * 20);
    if (step === bucket.current && max.current < 0.98) return;
    bucket.current = step;
    if (max.current > 0.98 && !progress?.kept) onProgress({ ratio: 1, kept: true });
    else if (!progress?.kept) onProgress({ ratio: max.current, kept: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex h-9 w-fit items-center gap-2 rounded-full bg-white/80 px-3 text-sm">
        <ArrowLeft className="size-4" /> Modules
      </button>
      <article className="overflow-hidden rounded-[28px] bg-[#07141c] text-paper">
        <video
          ref={ref}
          key={module.id}
          src={module.src}
          poster={module.cover}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          playsInline
          className="aspect-video w-full bg-black object-contain"
          onTimeUpdate={tick}
          onSeeking={guard}
          onEnded={() => onProgress({ ratio: 1, kept: true })}
        />
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold">{module.category}</p>
            <h2 className="font-display mt-1 text-2xl">{module.title}</h2>
            <p className="mt-1 max-w-lg text-sm text-paper/70">{module.blurb}</p>
          </div>
          <p className="text-sm tabular-nums text-gold">{kept ? `Kept · ${module.score}` : `${Math.round(ratio * 100)}%`}</p>
        </div>
      </article>
      <p className="text-xs text-mute">The house owns this film. You cannot upload here. It plays from the start. The score lands when it ends.</p>
    </div>
  );
}
