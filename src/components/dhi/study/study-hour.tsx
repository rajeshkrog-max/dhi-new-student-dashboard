/**
 * Study hour.
 * Live — you large, four of the house beside you, view-all gallery, subject chat.
 * Away — only your profile.
 * DND — no people, no chat. Lamp and pomodoro. Alone.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Clock, Lock, MessageCircle, Mic, MicOff, Pause, PhoneOff, Play, Search, Send, Video, VideoOff, X } from "lucide-react";
import { LIVE, LOCKED, opensLabel, phase, remaining } from "@/lib/dhi/study/hours";
import type { StudyLine } from "@/lib/dhi/study/schema";
import { cn } from "@/lib/utils";

type Self = "live" | "away" | "dnd";
const POMO = 25 * 60;
const TRACKS = [
  { name: "Grove rain", hz: 174 },
  { name: "Lamp", hz: 220 },
  { name: "Night lake", hz: 146 },
];

export function StudyHourRoom() {
  const [now, setNow] = useState(() => Date.now());
  const [inside, setInside] = useState(phase(LIVE) === "live");
  const [self, setSelf] = useState<Self>("live");
  const [view, setView] = useState<"room" | "all">("room");
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const [chat, setChat] = useState(false);
  const [q, setQ] = useState("");
  const [seen, setSeen] = useState(0);
  const [lines, setLines] = useState<StudyLine[]>(LIVE.lines);
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState("shubham");
  const [pomo, setPomo] = useState(POMO);
  const [pomoOn, setPomoOn] = useState(false);
  const [track, setTrack] = useState(0);
  const [music, setMusic] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pomoOn) return;
    const t = setInterval(() => setPomo((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [pomoOn]);

  useEffect(() => {
    if (!music) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TRACKS[track].hz;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return () => {
      osc.stop();
      void ctx.close();
    };
  }, [music, track]);

  useEffect(() => {
    const t = setInterval(() => setSpeaking((s) => (s === "shubham" ? "meera" : "shubham")), 8000);
    return () => clearInterval(t);
  }, []);

  const livePhase = phase(LIVE, now);
  const lockedPhase = phase(LOCKED, now);
  if (!inside || livePhase !== "live") {
    return <Board now={now} livePhase={livePhase} lockedPhase={lockedPhase} onEnter={() => livePhase === "live" && setInside(true)} />;
  }

  const you = LIVE.seats.find((s) => s.you) ?? LIVE.seats[0];
  const liveOthers = LIVE.seats.filter((s) => !s.you && s.presence === "live");
  const unread = chat ? 0 : Math.max(0, lines.length - seen);
  const last = lines[lines.length - 1];

  function send() {
    const body = text.trim();
    if (!body) return;
    setLines((ls) => [...ls, { id: `me-${ls.length}`, author: "Suzzy Glass", body, at: clockLabel(), }]);
    setText("");
    setSeen((n) => n + 1);
  }

  function openChat() {
    setSeen(lines.length);
    setChat(true);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[#07141c] text-paper">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">{self === "dnd" ? "Alone" : LIVE.title}</p>
          <p className="text-xs text-paper/50">{self === "dnd" ? "No one can see you" : LIVE.subject}</p>
        </div>
        <span className="ml-auto hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm sm:flex">
          <Clock className="size-3.5 text-gold" />
          <span className="tabular-nums text-gold">{remaining(LIVE, now)}</span>
        </span>
        <StatusSwitch value={self} onChange={(v) => { setSelf(v); setView("room"); setChat(false); }} />
      </header>

      {self === "dnd" && (
        <Alone
          pomo={pomo}
          running={pomoOn}
          track={track}
          music={music}
          onToggle={() => setPomoOn((v) => !v)}
          onReset={() => { setPomoOn(false); setPomo(POMO); }}
          onTrack={(i) => setTrack(i)}
          onMusic={() => setMusic((v) => !v)}
        />
      )}

      {self === "away" && (
        <div className="grid min-h-0 flex-1 place-items-center px-6 pb-8">
          <article className="w-full max-w-sm text-center">
            <img src={you.image ?? ""} alt="" className="mx-auto size-40 rounded-full object-cover object-top ring-4 ring-white/10" />
            <h2 className="font-display mt-5 text-3xl">{you.name}</h2>
            <p className="mt-1 text-sm text-paper/60">Away from the hour. The sitting continues. Your camera is dark.</p>
            <span className="mt-4 inline-block rounded-full bg-gold/80 px-3 py-1 text-xs text-gold-ink">Away</span>
          </article>
        </div>
      )}

      {self === "live" && view === "all" && (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <button type="button" onClick={() => setView("room")} className="mb-3 flex h-9 w-fit items-center gap-2 rounded-full bg-white/10 px-3 text-sm">
            <ArrowLeft className="size-4" /> Back to you
          </button>
          <div className="grid min-h-0 flex-1 auto-rows-[140px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {liveOthers.map((s) => (
              <Face key={s.id} name={s.name} role={s.role} image={s.image} speaking={s.id === speaking} />
            ))}
          </div>
        </div>
      )}

      {self === "live" && view === "room" && (
        <div className="grid min-h-0 flex-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div className="grid grid-cols-2 grid-rows-3 gap-3">
            {liveOthers.slice(0, 4).map((s) => (
              <Face key={s.id} name={s.name} role={s.role} image={s.image} speaking={s.id === speaking} />
            ))}
            <button type="button" onClick={() => setView("all")} className="col-span-2 grid place-items-center rounded-3xl bg-white/8 text-sm text-paper/80 ring-1 ring-white/10">
              View all · {liveOthers.length} studying
            </button>
          </div>

          <div className="flex min-h-[280px] flex-col gap-3">
            <article className="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-[#102833]">
              {cam && you.image ? (
                <img src={you.image} alt="" className="absolute inset-0 size-full object-cover object-[center_18%]" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-3xl">{you.name.slice(0, 1)}</div>
              )}
              <p className="absolute bottom-16 left-4 text-sm">You</p>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                <Ctrl on={cam} onClick={() => setCam((v) => !v)} label={cam ? "Camera on" : "Camera off"}>
                  {cam ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                </Ctrl>
                <Ctrl on={mic} onClick={() => setMic((v) => !v)} label={mic ? "Mic on" : "Mic off"}>
                  {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </Ctrl>
                <button type="button" onClick={() => setInside(false)} className="grid size-11 place-items-center rounded-full bg-[#c45c4a]" aria-label="Leave the hour">
                  <PhoneOff className="size-4" />
                </button>
              </div>
              <button type="button" onClick={openChat} className="absolute right-3 top-3 grid size-10 place-items-center rounded-2xl bg-black/40" aria-label="Chat">
                <MessageCircle className="size-4" />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#c45c4a] px-1 text-[10px]">{unread}</span>}
              </button>
            </article>
            <button type="button" onClick={openChat} className="flex items-center gap-3 rounded-3xl bg-white/8 px-4 py-3 text-left ring-1 ring-white/10">
              <span className="flex h-6 items-end gap-0.5" aria-hidden>
                {[4, 8, 5, 10, 6].map((h, i) => (
                  <span key={i} className="w-0.5 rounded-full bg-mint" style={{ height: h }} />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{last?.body}</span>
                <span className="text-[11px] text-paper/50">{last?.author} · on {LIVE.subject}</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {chat && self === "live" && (
        <div className="absolute inset-0 z-20 flex justify-end bg-black/40" onClick={() => setChat(false)}>
          <aside className="flex h-full w-[min(100%,360px)] flex-col bg-[#0b1c26]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm">Subject chat</p>
              <button type="button" onClick={() => setChat(false)} className="grid size-8 place-items-center rounded-full bg-white/10" aria-label="Close chat">
                <X className="size-4" />
              </button>
            </div>
            <label className="mx-4 mb-2 flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm">
              <Search className="size-3.5 opacity-50" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a line…" className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
              {lines.filter((l) => l.body.toLowerCase().includes(q.trim().toLowerCase())).map((l) => (
                <li key={l.id}>
                  <p className="text-[11px] text-paper/50">{l.author} · {l.at}</p>
                  <p className="text-sm leading-snug">{l.body}</p>
                </li>
              ))}
            </ul>
            <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`On ${LIVE.subject}…`} className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-sm outline-none" />
              <button type="submit" className="grid size-11 place-items-center rounded-full bg-gold text-gold-ink" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

function Alone({
  pomo, running, track, music, onToggle, onReset, onTrack, onMusic,
}: {
  pomo: number; running: boolean; track: number; music: boolean;
  onToggle: () => void; onReset: () => void; onTrack: (i: number) => void; onMusic: () => void;
}) {
  const m = String(Math.floor(pomo / 60)).padStart(2, "0");
  const s = String(pomo % 60).padStart(2, "0");
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-6 pb-8">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Do not disturb</p>
        <p className="font-display mt-2 text-4xl tabular-nums">{m}:{s}</p>
        <p className="mt-1 text-sm text-paper/50">One sitting. Twenty-five minutes.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onToggle} className="h-11 rounded-full bg-gold px-5 text-sm text-gold-ink">
            {running ? "Pause" : "Start"}
          </button>
          <button type="button" onClick={onReset} className="h-11 rounded-full bg-white/10 px-5 text-sm">Reset</button>
        </div>
        <div className="mt-8 space-y-2 text-left">
          {TRACKS.map((t, i) => (
            <button key={t.name} type="button" onClick={() => onTrack(i)} className={cn("flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm", i === track ? "bg-white/12" : "bg-white/5")}>
              <span>{t.name}</span>
              {i === track && music ? <Pause className="size-4 text-gold" /> : <Play className="size-4 text-paper/50" />}
            </button>
          ))}
          <button type="button" onClick={onMusic} className="mt-2 h-11 w-full rounded-full bg-white/10 text-sm">
            {music ? "Stop the lamp" : "Play the lamp"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusSwitch({ value, onChange }: { value: Self; onChange: (v: Self) => void }) {
  const items: Self[] = ["live", "away", "dnd"];
  return (
    <div className="flex rounded-full bg-white/10 p-1 text-xs">
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onChange(item)} className={cn("h-8 rounded-full px-3 uppercase", value === item ? "bg-gold text-gold-ink" : "text-paper/60")}>
          {item}
        </button>
      ))}
    </div>
  );
}

function Face({ name, role, image, speaking }: { name: string; role: string; image: string | null; speaking: boolean }) {
  return (
    <article className={cn("relative overflow-hidden rounded-3xl bg-[#102833]", speaking && "ring-2 ring-gold")}>
      {image ? <img src={image} alt="" className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-lg">{name.slice(0, 1)}</div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="text-[10px] text-paper/70">{speaking ? "Speaking" : role}</p>
      </div>
    </article>
  );
}

function Board({
  now, livePhase, lockedPhase, onEnter,
}: {
  now: number;
  livePhase: "locked" | "live" | "closed";
  lockedPhase: "locked" | "live" | "closed";
  onEnter: () => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="rounded-[28px] border border-white/80 bg-[#07141c] p-6 text-paper">
        <p className="text-[11px] uppercase tracking-[0.14em] text-gold">{livePhase === "live" ? "Open now" : livePhase === "closed" ? "Closed" : "Locked"}</p>
        <h2 className="font-display mt-2 text-3xl">{LIVE.title}</h2>
        <p className="mt-2 text-sm text-paper/70">{LIVE.teacher} dedicated {LIVE.subject}. Voice and camera. The room drops when the clock ends.</p>
        <p className="mt-4 text-sm tabular-nums text-gold">{livePhase === "live" ? `${remaining(LIVE, now)} left` : "The window has shut."}</p>
        <button type="button" disabled={livePhase !== "live"} onClick={onEnter} className="mt-5 h-11 rounded-full bg-gold px-5 text-sm font-medium text-gold-ink disabled:opacity-40">
          Enter the hour
        </button>
      </article>
      <article className="rounded-[28px] border border-white/80 bg-white/70 p-6">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-mute">
          <Lock className="size-3.5" /> {lockedPhase === "locked" ? "Locked" : lockedPhase}
        </p>
        <h2 className="font-display mt-2 text-3xl">{LOCKED.title}</h2>
        <p className="mt-2 text-sm text-mute">{LOCKED.teacher} set this hour. It opens at {opensLabel(LOCKED)}. You cannot sit early.</p>
        <button type="button" disabled className="mt-5 h-11 rounded-full bg-home/10 px-5 text-sm text-mute">Wait for the clock</button>
      </article>
    </div>
  );
}

function Ctrl({ children, on, onClick, label }: { children: ReactNode; on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("grid size-11 place-items-center rounded-full", on ? "bg-black/45 text-paper" : "bg-white text-home")}>
      {children}
    </button>
  );
}

function clockLabel() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
