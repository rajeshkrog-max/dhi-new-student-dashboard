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
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const countdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min ${String(s).padStart(2, "0")} s`;
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

const FEEL_WORDS: Record<string, string> = { energised: "Energised", okay: "Okay", drained: "Drained" };

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
      <p className="text-xs text-mute">You stayed {card.minutes} minutes. Two taps and a subject if you like, or skip it. A skip changes nothing.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="How you felt">
        {Object.entries(FEEL_WORDS).map(([key, label]) => (
          <Button key={key} variant={feel === key ? "solid" : "quiet"} onClick={() => setFeel(key)} data-testid={`feel-${key}`} aria-pressed={feel === key}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Your focus, from 1 to 5">
        <span className="text-sm text-mute">Focus</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <Button key={n} variant={focus === n ? "solid" : "quiet"} onClick={() => setFocus(n)} data-testid={`focus-${n}`} aria-pressed={focus === n}>
            {n}
          </Button>
        ))}
      </div>
      {/* An optional subject (house spec 0028), the same list as the desk card. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={SUBJECT_LABEL}>
        <span className="text-sm text-mute">{SUBJECT_LABEL}</span>
        {SUBJECTS.map((s) => (
          <Button key={s} variant={subject === s ? "solid" : "quiet"} onClick={() => setSubject(subject === s ? "" : s)} data-testid={`subject-${s}`} aria-pressed={subject === s}>
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
      <Notice className="px-4 py-3 text-sm" data-testid="hour-none">
        No study hour is set yet. When DHI sets one, it appears here.
      </Notice>
    );
  }
  const hour = current.hour;
  const isOpen = now >= hour.opensAt && now < hour.closesAt;
  if (!isOpen && now < hour.opensAt) {
    return (
      <Card className="space-y-2" data-testid="hour-upcoming">
        <h2 className="text-sm font-semibold">The next study hour</h2>
        <p className="text-sm">
          Opens {when(hour.opensAt)} and closes {when(hour.closesAt)}.
        </p>
        <p className="text-sm text-mute">Opens in {countdown(hour.opensAt - now)}.</p>
      </Card>
    );
  }
  if (!isOpen) {
    return (
      <Card className="space-y-2" data-testid="hour-over">
        <h2 className="text-sm font-semibold">The study hour is over</h2>
        <p className="text-sm text-mute">It closed at {when(hour.closesAt)}. Your minutes are saved. The next hour shows here once DHI sets it.</p>
      </Card>
    );
  }
  return <OpenHour closesAt={hour.closesAt} now={now} mode={current.mySeat?.mode ?? null} />;
}

function OpenHour({ closesAt, now, mode }: { closesAt: number; now: number; mode: string | null }) {
  const enter = useMutation(api.studyHour.enter);
  const leave = useMutation(api.studyHour.leave);
  const beat = useMutation(api.studyHour.beat);
  const [error, setError] = useState("");

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
    } catch {
      setError("We could not seat you. Please try again.");
    }
  }
  async function stand() {
    setError("");
    try {
      await leave({});
    } catch {
      setError("We could not save your stay. Please try again.");
    }
  }

  return (
    <div className="space-y-4" data-testid="study-hour-room">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">The study hour is open</h2>
          <span className="text-sm tabular-nums" data-testid="hour-remaining">
            Closes in {countdown(closesAt - now)}
          </span>
        </div>
        {mode === null ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => sit("live")} data-testid="enter-live">
              Sit Live
            </Button>
            <Button variant="quiet" onClick={() => sit("away")} data-testid="enter-away">
              Sit Away
            </Button>
            <Button variant="quiet" onClick={() => sit("dnd")} data-testid="enter-dnd">
              Do not disturb
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-mute">You are seated: {MODE_WORDS[mode]}.</span>
            {(["live", "away", "dnd"] as const)
              .filter((m) => m !== mode)
              .map((m) => (
                <Button key={m} variant="quiet" onClick={() => sit(m)} data-testid={`mode-${m}`}>
                  {MODE_WORDS[m]}
                </Button>
              ))}
            <Button variant="quiet" onClick={stand} data-testid="hour-leave">
              Leave
            </Button>
          </div>
        )}
        {error && (
          <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
      </Card>
      {mode !== null && (
        <>
          <Seats />
          <Chat mode={mode} />
        </>
      )}
      {/* Last, so it arriving with a Live seat moves nothing above it. */}
      {mode === "live" && <CallCard />}
    </div>
  );
}

// The hour's call, for a Live seat: the notice first, then the call on the student's own press.
function CallCard() {
  const [joined, setJoined] = useState(false);
  return (
    <Card className="space-y-3" data-testid="hour-call">
      {!HOUR_CALL_WORDS_APPROVED && <p className="text-xs text-mute">{HOUR_CALL_WORDS.draft}</p>}
      <h2 className="text-sm font-semibold">{HOUR_CALL_WORDS.title}</h2>
      <p className="text-sm text-mute">{HOUR_CALL_WORDS.intro}</p>
      <p className="text-xs text-mute touch:text-sm">{HOUR_CALL_WORDS.recordedNotice}</p>
      {joined ? (
        <Suspense fallback={<p className="text-sm text-mute">{HOUR_CALL_WORDS.loading}</p>}>
          <HourCall onDone={() => setJoined(false)} />
        </Suspense>
      ) : (
        <Button onClick={() => setJoined(true)} data-testid="hour-call-join">
          {HOUR_CALL_WORDS.join}
        </Button>
      )}
    </Card>
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

function Seats() {
  const seats = useQuery(api.studyHour.seats, {});
  // While the seats load, the card holds the place of the student's own seat, so the chat below does not jump when they arrive.
  if (seats === undefined) {
    return (
      <Card className="space-y-3" data-testid="seat-list-loading">
        <h2 className="text-sm font-semibold">In the hour with you</h2>
        <div className="rounded-control border border-home/20 bg-white/80 p-4" aria-hidden>
          <p className="font-display text-xl">&nbsp;</p>
          <p className="text-xs text-mute">&nbsp;</p>
        </div>
        <p className="text-sm text-mute">&nbsp;</p>
      </Card>
    );
  }
  if (!seats.seated) return null;
  const mine = seats.people.find((p) => p.mine);
  const others = seats.people.filter((p) => !p.mine);
  const alone = mine?.mode === "dnd";
  return (
    <Card className="space-y-3" data-testid="seat-list">
      <h2 className="text-sm font-semibold">In the hour with you</h2>
      {mine && (
        <div className="rounded-control border border-home/20 bg-white/80 p-4" data-testid="my-seat">
          <p className="font-display text-xl">{mine.name}</p>
          <p className="text-xs text-mute">{MODE_WORDS[mine.mode]}</p>
        </div>
      )}
      {alone ? (
        <p className="text-sm text-mute">You are in Do not disturb. You see no one, and no one sees you.</p>
      ) : others.length === 0 ? (
        <p className="text-sm text-mute">No one else from your school is seated yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <li key={p.seatId} className="rounded-control border border-home/15 bg-white/70 p-3 text-sm" data-testid="seat-other">
              <span className="block font-medium">{p.name}</span>
              <span className="text-xs text-mute">{MODE_WORDS[p.mode]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Chat({ mode }: { mode: string }) {
  const messages = useQuery(api.studyHour.messages, {});
  const chat = useMutation(api.studyHour.chat);
  const report = useMutation(api.studyHour.report);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [reported, setReported] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  if (mode === "dnd") {
    return (
      <Card data-testid="chat-closed">
        <p className="text-sm text-mute">Chat is closed while you are in Do not disturb.</p>
      </Card>
    );
  }

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

  return (
    <Card className="space-y-3" data-testid="chat">
      <h2 className="text-sm font-semibold">Chat</h2>
      <p className="text-xs text-mute">Every message is kept so a teacher can look at it. Please be kind.</p>
      <div className="max-h-64 space-y-2 overflow-y-auto" data-testid="chat-messages">
        {messages?.length === 0 && <p className="text-sm text-mute">No messages yet.</p>}
        {messages?.map((m) => (
          <p key={m.messageId} className="text-sm">
            <span className="font-medium">{m.mine ? "You" : m.authorName}: </span>
            {m.text}
            {!m.mine && (
              <button type="button" className="ml-2 text-xs text-mute underline" onClick={() => flag(m.messageId)} disabled={reported.includes(m.messageId)}>
                {reported.includes(m.messageId) ? "Reported" : "Report"}
              </button>
            )}
          </p>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex flex-wrap gap-2">
        <input
          data-testid="chat-input"
          className="min-w-0 flex-1 rounded-control border border-home/15 bg-white/80 px-3 py-2 text-sm"
          value={text}
          maxLength={MAX_MESSAGE}
          onChange={(e) => setText(e.target.value)}
          aria-label="Write a message"
        />
        <Button type="submit" disabled={text.trim().length === 0} data-testid="chat-send">
          Send
        </Button>
      </form>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
    </Card>
  );
}
