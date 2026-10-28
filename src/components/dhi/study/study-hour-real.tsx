// The study hour, the student's side (spec house/0015). A DHI admin sets the hour; a student sits in it only while it is open, as Live, Away or Do
// not disturb. Seats and chat update live, and show only the students of the student's own institute. Do not disturb shows no people and no chat,
// and hides the student from others. The screen sends a heartbeat every 20 seconds; a seat that goes quiet is dropped by the server. A Live seat may
// join the hour's call, camera and voice, recorded (house spec 0027); the call is loaded only when joined, and leaves when the seat stops being Live.
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { BEAT_MS, MAX_MESSAGE } from "@dhi/backend/hourRules";
import { SUBJECTS } from "@dhi/backend/sessionRules";
import { SUBJECT_LABEL, SUBJECT_WORDS } from "@/lib/dhi/desk-words";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Sheet } from "@/components/dhi/sheet";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  Lock,
  MessageCircle,
  Pause,
  PhoneOff,
  Play,
  Search,
  Send,
  Video,
} from "lucide-react";
import { HourRecordings } from "@/components/dhi/study/hour-recordings";
import { HOUR_CALL_WORDS, HOUR_CALL_WORDS_APPROVED } from "@/lib/dhi/hour-call-words";

const HourCall = lazy(() => import("@/components/dhi/study/hour-call"));

const MODE_WORDS: Record<string, string> = { live: "Live", away: "Away", dnd: "Do not disturb" };
const WORDS: Record<string, string> = {
  not_open: "The hour has not opened yet.",
  closed: "The hour is over.",
  bad_mode: "Please pick Live, Away or Do not disturb.",
  rate_limited: "That was too many taps for now. Please wait a little.",
  not_seated: "Please take a seat first.",
  dnd: "You are in Do not disturb, so chat is closed for you.",
  bad_text: `Please write a message of up to ${MAX_MESSAGE} characters.`,
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const countdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h} h ${String(m).padStart(2, "0")} min`
    : `${m} min ${String(s).padStart(2, "0")} s`;
};

export function StudyHourReal() {
  return (
    <div className="space-y-4">
      <FeedbackCard />
      <StudyHourContent />
      <SharedHourRecordings />
    </div>
  );
}

const FEEL_WORDS: Record<string, string> = {
  energised: "Energised",
  okay: "Okay",
  drained: "Drained",
};

// The after session card (spec house/0018): offered once when a stay of 20 minutes or more has ended. It can be skipped, and a skip changes nothing.
function FeedbackCard() {
  const card = useQuery(api.sessionFeedback.pending, {});
  const answer = useMutation(api.sessionFeedback.answer);
  const skip = useMutation(api.sessionFeedback.skip);
  const [feel, setFeel] = useState("");
  const [focus, setFocus] = useState(0);
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  if (!card) return null;

  async function save() {
    if (!card) return;
    setError("");
    try {
      const r = await answer({ seatId: card.seatId, feel, focus, ...(subject ? { subject } : {}) });
      if (!r.ok) setError("We could not save that. You can skip this card.");
    } catch {
      setError("We could not save that. You can skip this card.");
    }
  }
  async function leaveIt() {
    if (!card) return;
    try {
      await skip({ seatId: card.seatId });
    } catch {
      setError("We could not skip the card. Please try again.");
    }
  }

  return (
    <Card className="space-y-3" data-testid="feedback-card">
      <h2 className="text-sm font-semibold">How did that sitting feel?</h2>
      <p className="text-xs text-mute">
        You stayed {card.minutes} minutes. Two taps and a subject if you like, or skip it. A skip
        changes nothing.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="How you felt">
        {Object.entries(FEEL_WORDS).map(([key, label]) => (
          <Button
            key={key}
            variant={feel === key ? "solid" : "quiet"}
            onClick={() => setFeel(key)}
            data-testid={`feel-${key}`}
            aria-pressed={feel === key}
          >
            {label}
          </Button>
        ))}
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Your focus, from 1 to 5"
      >
        <span className="text-sm text-mute">Focus</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            variant={focus === n ? "solid" : "quiet"}
            onClick={() => setFocus(n)}
            data-testid={`focus-${n}`}
            aria-pressed={focus === n}
          >
            {n}
          </Button>
        ))}
      </div>
      {/* An optional subject (house spec 0028), the same list as the desk card. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={SUBJECT_LABEL}>
        <span className="text-sm text-mute">{SUBJECT_LABEL}</span>
        {SUBJECTS.map((s) => (
          <Button
            key={s}
            variant={subject === s ? "solid" : "quiet"}
            onClick={() => setSubject(subject === s ? "" : s)}
            data-testid={`subject-${s}`}
            aria-pressed={subject === s}
          >
            {SUBJECT_WORDS[s]}
          </Button>
        ))}
      </div>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!feel || focus === 0} data-testid="feedback-save">
          Save
        </Button>
        <Button variant="quiet" onClick={leaveIt} data-testid="feedback-skip">
          Skip
        </Button>
      </div>
    </Card>
  );
}

// The room itself, drawn as the house mockup's dark study room: the hour's clock in gold, the Live, Away and Do not disturb switch, the faces of the
// school's students who sit Live or Away, the student's own tile with the call, and the chat in a side panel.
const ROOM =
  "relative flex min-h-[28rem] flex-col overflow-hidden rounded-panel bg-night-panel text-paper";

function StudyHourContent() {
  const current = useQuery(api.studyHour.current, {});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (current === undefined) return <p className="text-sm text-mute">Loading the study hour…</p>;
  if (current.state === "none" || current.hour === null) {
    return (
      <Board
        label="Not set"
        title="Study hour"
        body="No study hour is set yet. When DHI sets one, it appears here. The room opens when the clock hits and closes when it ends."
        testId="hour-none"
      />
    );
  }
  const hour = current.hour;
  const isOpen = now >= hour.opensAt && now < hour.closesAt;
  if (!isOpen && now < hour.opensAt) {
    return (
      <Board
        label="Locked"
        title="The next study hour"
        body={`Opens ${when(hour.opensAt)} and closes ${when(hour.closesAt)}. You cannot sit early.`}
        clock={`Opens in ${countdown(hour.opensAt - now)}`}
        testId="hour-upcoming"
      />
    );
  }
  if (!isOpen) {
    return (
      <Board
        label="Closed"
        title="The study hour is over"
        body={`It closed at ${when(hour.closesAt)}. Your minutes are saved. The next hour shows here once DHI sets it.`}
        testId="hour-over"
      />
    );
  }
  return <OpenHour closesAt={hour.closesAt} now={now} mode={current.mySeat?.mode ?? null} />;
}

function Board({
  label,
  title,
  body,
  clock,
  testId,
}: {
  label: string;
  title: string;
  body: string;
  clock?: string;
  testId: string;
}) {
  return (
    <article
      className="rounded-panel border border-white/80 bg-night-panel p-6 text-paper"
      data-testid={testId}
    >
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-gold touch:text-xs">
        <Lock className="size-3.5" aria-hidden /> {label}
      </p>
      <h2 className="font-display mt-2 text-3xl">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-paper/80">{body}</p>
      {clock && <p className="mt-4 text-sm tabular-nums text-gold">{clock}</p>}
      <button
        type="button"
        disabled
        className="mt-5 h-11 rounded-full bg-white/10 px-5 text-sm text-paper/70"
      >
        Wait for the clock
      </button>
    </article>
  );
}

function OpenHour({ closesAt, now, mode }: { closesAt: number; now: number; mode: string | null }) {
  const enter = useMutation(api.studyHour.enter);
  const leave = useMutation(api.studyHour.leave);
  const beat = useMutation(api.studyHour.beat);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  // The heartbeat, while seated.
  useEffect(() => {
    if (mode === null) return;
    const id = setInterval(() => void beat({}).catch(() => {}), BEAT_MS);
    return () => clearInterval(id);
  }, [mode, beat]);

  async function sit(next: string) {
    setError("");
    try {
      const r = await enter({ mode: next });
      if (!r.ok) setError(WORDS[r.code] ?? "We could not seat you.");
      else if (next === "dnd") setChatOpen(false);
    } catch {
      setError("We could not seat you. Please try again.");
    }
  }
  async function stand() {
    setError("");
    setChatOpen(false);
    try {
      await leave({});
    } catch {
      setError("We could not save your stay. Please try again.");
    }
  }

  return (
    <div className={ROOM} data-testid="study-hour-room">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">
            {mode === "dnd" ? "Alone" : "Study hour"}
          </p>
          <p className="text-xs text-paper/70">
            {mode === "dnd"
              ? "No one can see you"
              : mode === null
                ? "Pick how you sit"
                : "Your school, studying together"}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm">
          <Clock className="size-3.5 text-gold" aria-hidden />
          <span className="tabular-nums text-gold" data-testid="hour-remaining">
            Closes in {countdown(closesAt - now)}
          </span>
        </span>
        {mode !== null && (
          <>
            <div
              className="flex rounded-full bg-white/10 p-1 text-xs"
              role="group"
              aria-label="How you sit"
            >
              {(["live", "away", "dnd"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => mode !== m && void sit(m)}
                  data-testid={`mode-${m}`}
                  className={cn(
                    "h-8 rounded-full px-3 uppercase touch:h-11",
                    mode === m ? "bg-gold text-gold-ink" : "text-paper/70 hover:text-paper",
                  )}
                >
                  {m === "dnd" ? "DND" : m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={stand}
              aria-label="Leave the hour"
              title="Leave the hour"
              className="grid size-11 place-items-center rounded-full bg-danger"
              data-testid="hour-leave"
            >
              <PhoneOff className="size-4" aria-hidden />
            </button>
          </>
        )}
      </header>
      {error && (
        <Notice tone="danger" role="alert" className="mx-4 mb-2 px-4 py-3 text-sm">
          {error}
        </Notice>
      )}

      {mode === null ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 pb-8">
          <div className="w-full max-w-lg text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold touch:text-xs">
              Open now
            </p>
            <h2 className="font-display mt-2 text-3xl">Enter the hour</h2>
            <p className="mt-2 text-sm text-paper/70">
              Live shows your face and voice to your school. Away keeps your seat with your camera
              dark. Do not disturb hides you and the chat.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => sit("live")}
                data-testid="enter-live"
                className="h-12 rounded-full bg-gold px-5 text-sm font-medium text-gold-ink"
              >
                Sit Live
              </button>
              <button
                type="button"
                onClick={() => sit("away")}
                data-testid="enter-away"
                className="h-12 rounded-full bg-white/10 px-5 text-sm"
              >
                Sit Away
              </button>
              <button
                type="button"
                onClick={() => sit("dnd")}
                data-testid="enter-dnd"
                className="h-12 rounded-full bg-white/10 px-5 text-sm"
              >
                Do not disturb
              </button>
            </div>
          </div>
        </div>
      ) : mode === "dnd" ? (
        <Alone />
      ) : (
        <Seated mode={mode} onChat={() => setChatOpen(true)} />
      )}

      {mode !== null && mode !== "dnd" && (
        <Sheet
          open={chatOpen}
          onOpenChange={setChatOpen}
          side="right"
          tone="dark"
          title="Subject chat"
        >
          <Chat />
        </Sheet>
      )}
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "·";

// Live and Away: the others in a grid of faces (all of them on "View all"), the student's own tile with the call, and the last chat line.
function Seated({ mode, onChat }: { mode: string; onChat: () => void }) {
  const seats = useQuery(api.studyHour.seats, {});
  const messages = useQuery(api.studyHour.messages, {});
  const [all, setAll] = useState(false);
  const [seen, setSeen] = useState(0);
  const mine = seats?.seated ? seats.people.find((p) => p.mine) : undefined;
  const others = seats?.seated ? seats.people.filter((p) => !p.mine) : [];
  const count = messages?.length ?? 0;
  const unread = Math.max(0, count - seen);
  const last = messages?.[count - 1];
  const openChat = () => {
    setSeen(count);
    onChat();
  };

  if (mode === "away") {
    return (
      <div className="grid min-h-0 flex-1 place-items-center px-6 pb-8">
        <article className="w-full max-w-sm text-center" data-testid="seat-list">
          <div data-testid="my-seat">
            <div className="mx-auto grid size-40 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac font-display text-5xl text-white ring-4 ring-white/10">
              {initialsOf(mine?.name ?? "")}
            </div>
            <h2 className="font-display mt-5 text-3xl">{mine?.name ?? " "}</h2>
            <p className="mt-1 text-sm text-paper/70">
              Away from the hour. The sitting continues. Your camera is dark.
            </p>
            <span className="mt-4 inline-block rounded-full bg-gold/80 px-3 py-1 text-xs text-gold-ink">
              Away
            </span>
          </div>
          <p className="mt-4 text-xs text-paper/60">
            {others.length === 0
              ? "No one else from your school is seated yet."
              : `${others.length} from your school in the hour`}
          </p>
          <ChatStrip last={last} unread={unread} onOpen={openChat} />
        </article>
      </div>
    );
  }

  if (all) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" data-testid="seat-list">
        <button
          type="button"
          onClick={() => setAll(false)}
          className="mb-3 flex h-11 w-fit items-center gap-2 rounded-full bg-white/10 px-3 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to you
        </button>
        <ul className="grid min-h-0 flex-1 auto-rows-[140px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {others.map((p) => (
            <Face key={p.seatId} name={p.name} mode={p.mode} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-0 flex-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]"
      data-testid="seat-list"
    >
      <div className="flex flex-col gap-3">
        {others.length === 0 ? (
          <p className="grid min-h-40 flex-1 place-items-center rounded-panel bg-white/5 px-4 text-center text-sm text-paper/70 ring-1 ring-white/10">
            {seats === undefined ? " " : "No one else from your school is seated yet."}
          </p>
        ) : (
          <ul className="grid auto-rows-[140px] grid-cols-2 gap-3">
            {others.slice(0, 4).map((p) => (
              <Face key={p.seatId} name={p.name} mode={p.mode} />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setAll(true)}
          disabled={others.length === 0}
          className="h-12 rounded-panel bg-white/5 text-sm text-paper/80 ring-1 ring-white/10 disabled:opacity-50"
        >
          View all · {others.length} studying
        </button>
      </div>
      <div className="flex min-h-[280px] flex-col gap-3">
        <article
          className="relative overflow-hidden rounded-panel bg-white/5 p-4 ring-1 ring-white/10"
          data-testid="my-seat"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac font-display text-xl text-white"
              aria-hidden
            >
              {initialsOf(mine?.name ?? "")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl">{mine?.name ?? " "}</p>
              <p className="text-xs text-paper/70">You · {MODE_WORDS[mode]}</p>
            </div>
            <button
              type="button"
              onClick={openChat}
              className="relative ml-auto grid size-11 place-items-center rounded-control bg-black/40"
              aria-label={unread > 0 ? `Chat, ${unread} new` : "Chat"}
              data-testid="chat-open"
            >
              <MessageCircle className="size-4" aria-hidden />
              {unread > 0 && (
                <span
                  className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px]"
                  data-decorative
                >
                  {unread}
                </span>
              )}
            </button>
          </div>
          <CallCard />
        </article>
        <ChatStrip last={last} unread={unread} onOpen={openChat} />
      </div>
    </div>
  );
}

function Face({ name, mode }: { name: string; mode: string }) {
  return (
    <li
      className="relative overflow-hidden rounded-panel bg-white/5 ring-1 ring-white/10"
      data-testid="seat-other"
    >
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-full font-display text-2xl",
            mode === "away"
              ? "bg-white/10 text-paper/60"
              : "bg-gradient-to-br from-mint to-lilac text-home",
          )}
        >
          {initialsOf(name)}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="text-[10px] text-paper/70 touch:text-xs">{MODE_WORDS[mode]}</p>
      </div>
    </li>
  );
}

function ChatStrip({
  last,
  unread,
  onOpen,
}: {
  last: { authorName: string; text: string; mine: boolean } | undefined;
  unread: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 flex w-full items-center gap-3 rounded-panel bg-white/5 px-4 py-3 text-left ring-1 ring-white/10"
      data-testid="chat-strip"
    >
      <span className="flex h-6 items-end gap-0.5" aria-hidden>
        {[4, 8, 5, 10, 6].map((h, i) => (
          <span key={i} className="w-0.5 rounded-full bg-mint" style={{ height: h }} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{last ? last.text : "Open the chat"}</span>
        <span className="text-[11px] text-paper/60 touch:text-xs">
          {last
            ? `${last.mine ? "You" : last.authorName}${unread > 0 ? ` · ${unread} new` : ""}`
            : "Every message is kept so a teacher can look at it"}
        </span>
      </span>
    </button>
  );
}

const POMODORO = 25 * 60;
const TRACKS = [
  { name: "Grove rain", hz: 174 },
  { name: "Lamp", hz: 220 },
  { name: "Night lake", hz: 146 },
];

// Do not disturb: no people and no chat. A 25 minute focus timer and a soft tone the browser makes itself (nothing is fetched or sent).
function Alone() {
  const seats = useQuery(api.studyHour.seats, {});
  const mine = seats?.seated ? seats.people.find((p) => p.mine) : undefined;
  const [left, setLeft] = useState(POMODORO);
  const [running, setRunning] = useState(false);
  const [track, setTrack] = useState(0);
  const [music, setMusic] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!music) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
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

  return (
    <div className="grid min-h-0 flex-1 place-items-center px-6 pb-8">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold touch:text-xs">
          Do not disturb
        </p>
        <p className="font-display mt-2 text-4xl tabular-nums" role="timer">
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </p>
        <p className="mt-1 text-sm text-paper/70">One sitting. Twenty-five minutes.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setRunning((v) => !v)}
            className="h-11 rounded-full bg-gold px-5 text-sm text-gold-ink"
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setLeft(POMODORO);
            }}
            className="h-11 rounded-full bg-white/10 px-5 text-sm"
          >
            Reset
          </button>
        </div>
        <div className="mt-8 space-y-2 text-left">
          {TRACKS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              aria-pressed={i === track}
              onClick={() => setTrack(i)}
              className={cn(
                "flex h-12 w-full items-center justify-between rounded-control px-4 text-sm",
                i === track ? "bg-white/15" : "bg-white/5",
              )}
            >
              <span>{t.name}</span>
              {i === track && music ? (
                <Pause className="size-4 text-gold" aria-hidden />
              ) : (
                <Play className="size-4 text-paper/60" aria-hidden />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMusic((v) => !v)}
            className="mt-2 h-11 w-full rounded-full bg-white/10 text-sm"
          >
            {music ? "Stop the lamp" : "Play the lamp"}
          </button>
        </div>
        <p className="mt-6 text-xs text-paper/60" data-testid="chat-closed">
          Chat is closed while you are in Do not disturb. You see no one, and no one sees you.
        </p>
        <span className="sr-only" data-testid="my-seat">
          {mine?.name} · {MODE_WORDS.dnd}
        </span>
      </div>
    </div>
  );
}

// The hour's call, for a Live seat: the notice first, then the call on the student's own press.
function CallCard() {
  const [joined, setJoined] = useState(false);
  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-4" data-testid="hour-call">
      {!HOUR_CALL_WORDS_APPROVED && (
        <p className="text-xs text-paper/60">{HOUR_CALL_WORDS.draft}</p>
      )}
      <h2 className="text-sm font-semibold">{HOUR_CALL_WORDS.title}</h2>
      <p className="text-sm text-paper/70">{HOUR_CALL_WORDS.intro}</p>
      <p className="text-xs text-paper/70 touch:text-sm">{HOUR_CALL_WORDS.recordedNotice}</p>
      {joined ? (
        <div className="rounded-control bg-paper p-3 text-home">
          <Suspense fallback={<p className="text-sm text-mute">{HOUR_CALL_WORDS.loading}</p>}>
            <HourCall onDone={() => setJoined(false)} />
          </Suspense>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setJoined(true)}
            data-testid="hour-call-join"
            className="flex h-11 items-center gap-2 rounded-full bg-gold px-5 text-sm font-medium text-gold-ink"
          >
            <Video className="size-4" aria-hidden /> {HOUR_CALL_WORDS.join}
          </button>
        </div>
      )}
    </div>
  );
}

// Study hour recordings a teacher or DHI shared with this student, if any.
function SharedHourRecordings() {
  const shared = useQuery(api.hourShares.sharedWithMe, {});
  if (!shared || shared.length === 0) return null;
  return (
    <Card className="space-y-3" data-testid="hour-shared">
      <h2 className="text-sm font-semibold">{HOUR_CALL_WORDS.sharedTitle}</h2>
      {shared.map((s) => (
        <div key={`${s.hourId}-${s.instituteId}`} className="space-y-1">
          <p className="text-sm">{when(s.opensAt)}</p>
          <HourRecordings hourId={s.hourId} instituteId={s.instituteId} />
        </div>
      ))}
    </Card>
  );
}

// The chat, in the dark side panel: find a line, the messages, report one, send one.
function Chat() {
  const messages = useQuery(api.studyHour.messages, {});
  const chat = useMutation(api.studyHour.chat);
  const report = useMutation(api.studyHour.report);
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [error, setError] = useState("");
  const [reported, setReported] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await chat({ text });
      if (!r.ok) setError(WORDS[r.code] ?? "Your message was not sent.");
      else setText("");
    } catch {
      setError("Your message was not sent. Please try again.");
    }
  }
  async function flag(id: GenericId<"chatMessages">) {
    try {
      await report({ messageId: id });
      setReported((r) => [...r, id]);
    } catch {
      setError("We could not send your report. Please try again.");
    }
  }

  const shown = (messages ?? []).filter((m) =>
    m.text.toLowerCase().includes(find.trim().toLowerCase()),
  );
  return (
    <div className="flex min-h-full flex-1 flex-col gap-3" data-testid="chat">
      <p className="text-xs text-paper/70">
        Every message is kept so a teacher can look at it. Please be kind.
      </p>
      <label className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-3 text-sm has-[:focus-visible]:focus-ring">
        <Search className="size-3.5 opacity-60" aria-hidden />
        <input
          data-in-field
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find a line…"
          aria-label="Find a line"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-paper/50"
        />
      </label>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto" data-testid="chat-messages">
        {messages?.length === 0 && <p className="text-sm text-paper/70">No messages yet.</p>}
        {shown.map((m) => (
          <div key={m.messageId}>
            <p className="text-[11px] text-paper/60 touch:text-xs">
              {m.mine ? "You" : m.authorName}
              {!m.mine && (
                <button
                  type="button"
                  className="tap ml-2 underline"
                  onClick={() => flag(m.messageId)}
                  disabled={reported.includes(m.messageId)}
                >
                  {reported.includes(m.messageId) ? "Reported" : "Report"}
                </button>
              )}
            </p>
            <p className="text-sm leading-snug">{m.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <form onSubmit={send} className="flex gap-2">
        <input
          data-testid="chat-input"
          className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-sm outline-none placeholder:text-paper/50 focus-visible:focus-ring"
          value={text}
          maxLength={MAX_MESSAGE}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write to your school…"
          aria-label="Write a message"
        />
        <button
          type="submit"
          disabled={text.trim().length === 0}
          className="grid size-11 place-items-center rounded-full bg-gold text-gold-ink disabled:opacity-50"
          aria-label="Send"
          data-testid="chat-send"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
