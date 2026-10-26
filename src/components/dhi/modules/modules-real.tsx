// The Modules room, the student's side (spec house/0013). Films are DHI's own: a student cannot add one. A film plays from a short link the server
// gives, and the server records how far the student has watched, so progress survives a reload and a change of device. Jumping past what has been
// watched is closed on the screen and, whatever the screen does, on the server. The score is written once, when the film is watched to its end.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Academic", "Self help", "Mental health", "Kept"] as const;
const CATEGORY_WORDS: Record<string, string> = { academic: "Academic", self_help: "Self help", mental_health: "Mental health" };
const REPORT_EVERY_MS = 5000;
const FINISH_RETRIES = 3;
const FINISH_RETRY_MS = 4500;

type Film = {
  filmId: GenericId<"films">;
  title: string;
  category: string;
  blurb: string;
  cover: string;
  scoreValue: number;
  durationSec: number;
  ratio: number;
  kept: boolean;
};

export function ModulesReal() {
  const data = useQuery(api.films.list, {});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState<Film | null>(null);

  if (data === undefined) return <p className="text-sm text-mute">Loading films…</p>;
  if (open) return <Player film={data.films.find((f) => f.filmId === open.filmId) ?? open} onBack={() => setOpen(null)} />;

  const list = data.films.filter((f) => {
    if (filter === "All") return true;
    if (filter === "Kept") return f.kept;
    return CATEGORY_WORDS[f.category] === filter;
  });

  return (
    <div className="flex flex-col gap-4" data-testid="modules-room">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn("h-9 rounded-full px-3 text-sm touch:h-11 touch:min-w-11", filter === f ? "bg-home text-paper" : "bg-white/70 text-home")}
          >
            {f}
            {f === "Kept" && <span className="ml-1 text-xs opacity-70">{data.keptCount}</span>}
          </button>
        ))}
        <article className="ml-auto flex items-center gap-4 rounded-control bg-white/80 px-4 py-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-mute">Kept</p>
            <p className="font-display text-xl leading-none" data-testid="modules-kept">
              {data.keptCount}/{data.films.length}
            </p>
          </div>
          <div className="h-8 w-px bg-home/10" />
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-mute">Score</p>
            <p className="font-display text-xl leading-none" data-testid="modules-score">
              {data.score}
            </p>
          </div>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((f) => (
          <button key={f.filmId} type="button" onClick={() => setOpen(f)} className="overflow-hidden rounded-card bg-white/80 text-left shadow-sm" data-testid="film-card">
            <span className="relative block aspect-[16/10]">
              <img src={f.cover} alt="" className="size-full object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs">{CATEGORY_WORDS[f.category] ?? f.category}</span>
              {f.kept && (
                <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-mint text-grove" data-decorative>
                  <Check className="size-4" />
                </span>
              )}
            </span>
            <span className="block px-4 py-3">
              <span className="block font-medium">{f.title}</span>
              <span className="mt-1 block text-xs text-mute">DHI house</span>
              <span className="mt-3 block h-1 overflow-hidden rounded-full bg-home/10">
                <span className="block h-full rounded-full bg-grove" style={{ width: `${Math.round(f.ratio * 100)}%` }} />
              </span>
            </span>
          </button>
        ))}
      </div>
      {data.films.length === 0 && <p className="text-sm text-mute">No films are open yet. DHI adds them here once they are ready.</p>}
      {data.films.length > 0 && list.length === 0 && <p className="text-sm text-mute">Nothing in this tag yet.</p>}
    </div>
  );
}

function Player({ film, onBack }: { film: Film; onBack: () => void }) {
  const link = useMutation(api.films.playLink);
  const progress = useMutation(api.films.progress);
  const finish = useMutation(api.films.finish);
  const ref = useRef<HTMLVideoElement>(null);
  const max = useRef(film.kept ? film.durationSec : film.ratio * film.durationSec);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [kept, setKept] = useState(film.kept);
  const [ratio, setRatio] = useState(film.kept ? 1 : film.ratio);
  const finishing = useRef(false);

  // Ask the server for the play link, and where to resume from.
  useEffect(() => {
    let live = true;
    link({ filmId: film.filmId })
      .then((r) => {
        if (!live) return;
        if (!r.ok) {
          setError(r.code === "host_not_ready" ? "This film is not ready to play yet." : "We could not open this film.");
          return;
        }
        max.current = Math.max(max.current, r.furthestSec);
        setKept(r.kept);
        setUrl(r.url);
      })
      .catch(() => live && setError("We could not open this film."));
    return () => {
      live = false;
    };
  }, [film.filmId, link]);

  // Report how far the student has watched, every few seconds while it plays.
  useEffect(() => {
    if (kept || !url) return;
    const id = setInterval(() => {
      const video = ref.current;
      if (!video || video.paused || !video.duration) return;
      void progress({ filmId: film.filmId, seconds: video.currentTime }).catch(() => {});
    }, REPORT_EVERY_MS);
    return () => clearInterval(id);
  }, [film.filmId, kept, progress, url]);

  // The screen's own guard against jumping ahead. The server holds the same line whatever this does.
  function guard() {
    const video = ref.current;
    if (!video || !video.duration || kept) return;
    const allowed = max.current + 1;
    if (video.currentTime > allowed) video.currentTime = allowed;
  }
  function tick() {
    const video = ref.current;
    if (!video || !video.duration) return;
    if (video.currentTime > max.current) max.current = video.currentTime;
    setRatio(Math.min(1, max.current / video.duration));
  }
  async function ended() {
    const video = ref.current;
    if (!video || kept || finishing.current) return;
    finishing.current = true;
    // The server counts real time, so the end may need a moment before it is accepted: try a few times.
    for (let i = 0; i < FINISH_RETRIES; i += 1) {
      try {
        const r = await finish({ filmId: film.filmId, seconds: video.duration });
        if (r.ok) {
          setKept(true);
          setRatio(1);
          finishing.current = false;
          return;
        }
        if (r.code !== "not_finished") break;
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, FINISH_RETRY_MS));
    }
    finishing.current = false;
    setError("We could not save the end of this film. Please watch it again from the start.");
  }

  return (
    <div className="flex flex-col gap-4" data-testid="film-player">
      <button type="button" onClick={onBack} className="flex h-9 w-fit items-center gap-2 rounded-full bg-white/80 px-3 text-sm touch:h-11">
        <ArrowLeft className="size-4" /> Modules
      </button>
      <article className="overflow-hidden rounded-panel bg-night-panel text-paper">
        {url ? (
          <video
            ref={ref}
            key={film.filmId}
            src={url}
            poster={film.cover}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            className="aspect-video w-full bg-black object-contain"
            onTimeUpdate={tick}
            onSeeking={guard}
            onEnded={ended}
            data-testid="film-video"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center bg-black text-sm text-paper/70">{error || "Opening the film…"}</div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gold">{CATEGORY_WORDS[film.category] ?? film.category}</p>
            <h2 className="font-display mt-1 text-2xl">{film.title}</h2>
            <p className="mt-1 max-w-lg text-sm text-paper/70">{film.blurb}</p>
          </div>
          <p className="text-sm tabular-nums text-gold" data-testid="film-status">
            {kept ? `Kept · ${film.scoreValue}` : `${Math.round(ratio * 100)}%`}
          </p>
        </div>
      </article>
      {error && url && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-mute">The house owns this film. You cannot upload here. It plays from where you stopped. The score lands when it ends.</p>
    </div>
  );
}
