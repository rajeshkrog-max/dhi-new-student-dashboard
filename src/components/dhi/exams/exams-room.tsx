// The exams room, the student's side (spec house/0012), drawn as the house mockup. The list shows each paper sent to the student as a card whose
// colour fills as its window closes, with a countdown. Opening a paper shows "A quiet pariksha" first; the sitting starts only when the student says
// they are ready. In the sitting the questions come one at a time in two lanes (MCQ and Writing) with a numbered rail, a ring that shows the window
// left, the teacher's hint in a side panel, and a "Good sitting." check before the paper is offered. While a sitting is open the rest of the house is
// locked; the lock is client side only, as the spec says (the server never depends on it). A hint is the teacher's own and never gives the answer
// (no model runs during an exam, owner 2026-10-28). A mark shows only after the teacher has confirmed it, and the student can accept the feedback once.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import type { GenericId } from "convex/values";
import { ArrowLeft, ArrowRight, Award, Calendar, Clock, Lock, Sparkles } from "lucide-react";
import { Sheet } from "@/components/dhi/sheet";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { subjectWord } from "@/lib/dhi/desk-words";
import { cn } from "@/lib/utils";

const WORDS: Record<string, string> = {
  not_open: "This paper is not open yet.",
  closed: "This paper's time is over.",
  bad_choice: "Please pick one of the options.",
  bad_answer: "That answer is too long.",
  bad_question: "We could not find that question.",
  no_hint: "Your teacher did not write a hint for this question.",
  not_confirmed: "Your teacher has not confirmed this mark yet.",
  not_found: "We could not find that paper.",
  slow_down: "That was a lot in a short time. Please wait a moment and try again.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
};
const wordFor = (error: unknown): string => {
  const data = (error as { data?: { code?: string } } | null)?.data;
  return (data?.code && WORDS[data.code]) || "Something went wrong. Please try again.";
};
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const dateOf = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// How long a window is, in the largest whole unit that fits.
function spanWords(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 120) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hours`;
  return `${Math.round(h / 24)} days`;
}

// How long a student can stop typing in a long answer before it is kept. Leaving the box keeps it at once.
const KEEP_AFTER_MS = 4000;

// A second clock for the countdowns and the ring.
function useNow(every = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

type Row = {
  attemptId: GenericId<"paperAttempts">;
  title: string;
  opensAt: number;
  dueAt: number;
  status: string;
  mark: { total: number; maxTotal: number; remarks: string } | null;
  accepted: boolean;
  excused: boolean;
};

export function ExamsRoom({ onSitting }: { onSitting?: (locked: boolean) => void }) {
  const papers = useQuery(api.papers.mine, {});
  const [ready, setReady] = useState<Row | null>(null);
  const [sitting, setSitting] = useState<Row | null>(null);
  const [sittingOpen, setSittingOpen] = useState(false);
  const [note, setNote] = useState("");
  const now = useNow();

  // While a sitting is open on screen the frame closes the rooms that could help with a paper (the desk, blog, study hour and films). The server
  // holds the same lock from Start until the student hands in or the window closes, also after "Leave for now" or a reload (examLock.ts, owner
  // 2026-10-26), so this flag only makes the screen say so at once.
  useEffect(() => {
    onSitting?.(sittingOpen);
  }, [sittingOpen, onSitting]);
  useEffect(() => () => onSitting?.(false), [onSitting]);

  if (sitting) {
    return (
      <Sitting
        paper={sitting}
        onDone={(after) => {
          setNote(after ?? "");
          setSitting(null);
        }}
        onOpen={setSittingOpen}
      />
    );
  }
  if (ready) {
    return (
      <IdleCard
        paper={ready}
        onBack={() => setReady(null)}
        onStarted={() => {
          setSitting(ready);
          setReady(null);
        }}
      />
    );
  }
  if (papers === undefined) return <p className="text-sm text-mute">Loading your papers…</p>;
  if (papers.length === 0)
    return (
      <Notice className="px-4 py-3 text-sm">
        No papers yet. When your teacher sends one, it appears here.
      </Notice>
    );

  return (
    <div className="flex flex-col gap-4" data-testid="exams-room">
      <p className="text-sm text-mute">
        An exam here is a sitting with a window. Sit before it closes; when it closes, what you
        wrote is handed in for you.
      </p>
      {note && (
        <Notice
          role="status"
          className="bg-mint/40 px-4 py-3 text-sm text-grove"
          data-testid="exam-note"
        >
          {note}
        </Notice>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {papers.map((p) => (
          <ExamCard
            key={p.attemptId}
            paper={p}
            now={now}
            onOpen={() => setReady(p)}
            onContinue={() => setSitting(p)}
          />
        ))}
      </div>
    </div>
  );
}

function ExamCard({
  paper,
  now,
  onOpen,
  onContinue,
}: {
  paper: Row;
  now: number;
  onOpen: () => void;
  onContinue: () => void;
}) {
  const inWindow = now >= paper.opensAt && now < paper.dueAt;
  const beforeOpen = now < paper.opensAt;
  const accept = useMutation(api.exams.acceptFeedback);
  const [error, setError] = useState("");
  const canStart = paper.status === "assigned" && inWindow;
  const continueSitting = paper.status === "open" && inWindow;
  const waiting = (paper.status === "assigned" || paper.status === "open") && !paper.excused;

  // The wash fills as the window runs out: green with plenty of time, gold as the day moves, red when it is almost shut.
  const windowMs = Math.max(1, paper.dueAt - paper.opensAt);
  const fill = waiting && inWindow ? Math.min(1, Math.max(0, (now - paper.opensAt) / windowMs)) : 0;
  const tone = fill < 0.5 ? "bg-grove" : fill < 0.8 ? "bg-gold" : "bg-danger";

  async function acceptIt() {
    setError("");
    try {
      const r = await accept({ attemptId: paper.attemptId });
      if (!r.ok) setError(WORDS[r.code] ?? "We could not save that.");
    } catch (e) {
      setError(wordFor(e));
    }
  }

  const status = paper.excused
    ? "Not sat: the class was paused"
    : statusWords(paper.status, inWindow, beforeOpen);
  const line = !waiting
    ? paper.status === "confirmed"
      ? "Marked with remarks. A mark is for you, never a rank."
      : paper.status === "assigned" || paper.status === "open"
        ? "This window has closed."
        : "Offered to the teacher."
    : beforeOpen
      ? `Opens ${when(paper.opensAt)}.`
      : fill >= 0.8
        ? "Window almost shut. Sit today."
        : fill >= 0.5
          ? "The day is moving. Sit when you can be quiet."
          : "Plenty of sky left in this window.";

  return (
    <article
      className="relative overflow-hidden rounded-panel border border-white/80 bg-white/75 shadow-sm backdrop-blur-xl"
      data-testid="exam-row"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 opacity-30 motion-safe:transition-all motion-safe:duration-1000",
          tone,
        )}
        style={{ height: `${Math.round(fill * 100)}%` }}
      />
      <div className="relative z-10 flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute touch:text-xs">
              {status}
            </p>
            <h2 className="font-display mt-1 text-2xl font-medium">{paper.title}</h2>
          </div>
          {waiting && (inWindow || beforeOpen) && (
            <FlipClock
              to={beforeOpen ? paper.opensAt : paper.dueAt}
              now={now}
              label={beforeOpen ? "Time until it opens" : "Time left to sit"}
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Meta icon={Calendar} label="Closes" value={dateOf(paper.dueAt)} />
          <Meta icon={Clock} label="Window" value={spanWords(windowMs)} />
          <Meta
            icon={Award}
            label="Marks"
            value={paper.mark ? `${paper.mark.total}/${paper.mark.maxTotal}` : "—"}
          />
        </div>

        {paper.mark && (
          <div className="rounded-control bg-white/70 p-3 text-sm" data-testid="exam-mark">
            <p>
              Mark {paper.mark.total} of {paper.mark.maxTotal}
              {paper.mark.remarks ? `. ${paper.mark.remarks}` : ""}
            </p>
            {paper.accepted ? (
              <p className="mt-1 text-xs text-mute" data-testid="exam-accepted">
                You have read this feedback.
              </p>
            ) : (
              <Button variant="quiet" className="mt-2" onClick={acceptIt} data-testid="exam-accept">
                I have read this feedback
              </Button>
            )}
          </div>
        )}
        {error && (
          <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
            {error}
          </Notice>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-mute touch:text-xs">{line}</p>
          {canStart && <Button onClick={onOpen}>Open sitting</Button>}
          {continueSitting && (
            <Button onClick={onContinue} data-testid="exam-continue">
              Continue sitting
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function statusWords(status: string, inWindow: boolean, beforeOpen: boolean): string {
  if (status === "confirmed") return "Marked";
  if (status === "marked") return "Being marked";
  if (status === "submitted") return "Submitted";
  if (status === "open") return "In progress";
  if (beforeOpen) return "Not open yet";
  if (inWindow) return "Open now";
  return "Closed";
}

function FlipClock({ to, now, label }: { to: number; now: number; label: string }) {
  const left = Math.max(0, to - now);
  const units = [
    { n: Math.floor(left / 86_400_000), label: "Days" },
    { n: Math.floor((left % 86_400_000) / 3_600_000), label: "Hours" },
    { n: Math.floor((left % 3_600_000) / 60_000), label: "Min" },
    { n: Math.floor((left % 60_000) / 1000), label: "Sec" },
  ];
  return (
    <div className="flex gap-1" role="timer" aria-label={label}>
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <span className="grid h-9 min-w-9 place-items-center rounded-chip bg-home px-1.5 font-display text-sm tabular-nums text-paper">
            {String(u.n).padStart(2, "0")}
          </span>
          <span
            className="mt-0.5 text-[8px] uppercase tracking-wider text-mute touch:text-[10px]"
            data-decorative
          >
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-control bg-white/70 px-2 py-2">
      <Icon className="size-3.5 shrink-0 text-mute" aria-hidden />
      <span className="min-w-0">
        <span
          className="block text-[9px] uppercase tracking-wide text-mute touch:text-[10px]"
          data-decorative
        >
          {label}
        </span>
        <span className="block truncate font-medium">{value}</span>
      </span>
    </div>
  );
}

// "A quiet pariksha": what happens when the sitting starts, and the one button that starts it.
function IdleCard({
  paper,
  onBack,
  onStarted,
}: {
  paper: Row;
  onBack: () => void;
  onStarted: () => void;
}) {
  const start = useMutation(api.exams.start);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function begin() {
    setError("");
    setBusy(true);
    try {
      const r = await start({ attemptId: paper.attemptId });
      if (!r.ok) setError(WORDS[r.code] ?? "This paper is not open.");
      else onStarted();
    } catch (e) {
      setError(wordFor(e));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="exam-ready">
      <SittingHeader
        title={paper.title}
        sub={`Closes ${when(paper.dueAt)}`}
        onBack={onBack}
        backLabel="Back to exams"
      />
      <Card className="p-8 text-center">
        <p className="font-display text-3xl">A quiet pariksha</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-mute">
          When you start, the desk, blog, study hour and films close so the mind can stay here. Your
          teacher&rsquo;s hint may open a question, never the answer. The clock does not stop or
          restart, and what you wrote is handed in when the window closes.
        </p>
        {error && (
          <Notice tone="danger" role="alert" className="mx-auto mt-4 max-w-md px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
        <button
          type="button"
          onClick={begin}
          disabled={busy}
          className="mt-6 h-12 rounded-control bg-grove px-8 text-sm font-medium text-paper disabled:opacity-50"
        >
          {busy ? "Opening…" : "I am ready to sit"}
        </button>
      </Card>
    </div>
  );
}

function SittingHeader({
  title,
  sub,
  onBack,
  backLabel,
  children,
  locked,
}: {
  title: string;
  sub: string;
  onBack: () => void;
  backLabel: string;
  children?: ReactNode;
  locked?: boolean;
}) {
  return (
    <header className="rounded-card border border-white/80 bg-white/75 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="grid size-11 place-items-center rounded-control bg-white/80"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-medium">{title}</h2>
          <p className="text-sm text-mute">{sub}</p>
        </div>
        {children}
      </div>
      {locked && (
        <p className="mt-3 flex items-center gap-2 text-xs text-mute touch:text-sm">
          <Lock className="size-3.5" aria-hidden /> The house is quiet. Only this paper, until you
          offer it.
        </p>
      )}
    </header>
  );
}

// A long answer. What the student types is kept a few seconds after they pause, when they leave the box, and when they leave the screen, so a
// closed tab or a window that ends costs at most the last few seconds. `onSave` is read through a ref so a new function on each render does not
// keep what was typed over and over.
function LongAnswer({
  label,
  initial,
  onSave,
  onType,
}: {
  label: string;
  initial: string;
  onSave: (text: string) => void;
  onType: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const latest = useRef(initial);
  const kept = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useRef(onSave);
  save.current = onSave;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current !== kept.current) {
      kept.current = latest.current;
      save.current(latest.current);
    }
  }, []);

  useEffect(() => flush, [flush]);

  return (
    <textarea
      className="mt-5 min-h-56 w-full flex-1 resize-y rounded-control border border-white bg-white/90 p-4 text-sm leading-relaxed outline-none placeholder:text-mute"
      maxLength={2000}
      value={text}
      placeholder="Write as you would to a younger student in the courtyard. Slow is allowed."
      onChange={(e) => {
        latest.current = e.target.value;
        setText(e.target.value);
        onType(e.target.value);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, KEEP_AFTER_MS);
      }}
      onBlur={flush}
      aria-label={label}
    />
  );
}

type Item = {
  order: number;
  kind: string;
  subject: string;
  topic: string;
  text: string;
  options: string[];
  maxMarks: number;
  hasHint: boolean;
};

function Sitting({
  paper,
  onDone,
  onOpen,
}: {
  paper: Row;
  onDone: (note?: string) => void;
  onOpen: (open: boolean) => void;
}) {
  const attemptId = paper.attemptId;
  const sitting = useQuery(api.exams.questions, { attemptId });
  const answer = useMutation(api.exams.answer);
  const submit = useMutation(api.exams.submit);
  const askHint = useMutation(api.exams.hint);
  const [error, setError] = useState("");
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState<Record<number, string>>({});
  const [hintFor, setHintFor] = useState<Item | null>(null);
  const [lane, setLane] = useState<"mcq" | "long">("mcq");
  const [qi, setQi] = useState(0);
  const [confirm, setConfirm] = useState(false);
  // What is in a long answer box right now, so the counts and the word count do not wait for the save.
  const [typed, setTyped] = useState<Record<number, string>>({});
  const isOpen = sitting?.open === true;

  useEffect(() => {
    onOpen(isOpen);
    return () => onOpen(false);
  }, [isOpen, onOpen]);

  const items = useMemo(() => sitting?.items ?? [], [sitting]);
  const mcq = items.filter((q) => q.kind === "mcq");
  const long = items.filter((q) => q.kind !== "mcq");
  // A paper of one kind opens on the lane it has.
  const shownLane =
    lane === "mcq" && mcq.length === 0
      ? "long"
      : lane === "long" && long.length === 0
        ? "mcq"
        : lane;
  const list = shownLane === "mcq" ? mcq : long;
  const q = list[Math.min(qi, Math.max(0, list.length - 1))];

  if (sitting === undefined) return <p className="text-sm text-mute">Opening the paper…</p>;
  if (!sitting.open) {
    return (
      <Card className="space-y-3">
        <p className="text-sm">
          This paper is closed now. Anything you had written was submitted when its time ended.
        </p>
        <Button variant="quiet" onClick={() => onDone()}>
          Back to exams
        </Button>
      </Card>
    );
  }

  const saved = (question: number) => sitting.answers.find((a) => a.question === question);
  const textOf = (question: number) => typed[question] ?? saved(question)?.text ?? "";
  const done = (item: Item) =>
    item.kind === "mcq"
      ? saved(item.order)?.choice !== undefined
      : textOf(item.order).trim().length > 0;
  const counts = { m: mcq.filter(done).length, w: long.filter(done).length };
  const totalMarks = items.reduce((s, x) => s + (x.kind === "mcq" ? 1 : x.maxMarks), 0);

  async function keep(payload: { question: number; choice?: number; text?: string }) {
    setError("");
    try {
      const r = await answer({ attemptId, ...payload });
      if (!r.ok) setError(WORDS[r.code] ?? "Your answer was not saved.");
    } catch (e) {
      setError(wordFor(e));
    }
  }

  async function showHint(item: Item) {
    setError("");
    setHintFor(item);
    if (hints[item.order] !== undefined) return;
    try {
      const r = await askHint({ attemptId, question: item.order });
      if (r.ok) setHints((h) => ({ ...h, [item.order]: r.text }));
      else {
        setHintFor(null);
        setError(WORDS[r.code] ?? "We could not show the hint.");
      }
    } catch (e) {
      setHintFor(null);
      setError(wordFor(e));
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const r = await submit({ attemptId });
      if (!r.ok && r.code !== "closed") {
        setError(WORDS[r.code] ?? "We could not submit. Please try again.");
        setBusy(false);
        setConfirm(false);
        return;
      }
      onDone(
        r.ok
          ? "Well sat. Your teacher will read it with remarks, not a stamp of worth. The lamp moves after you read the note."
          : "Time ended just before you pressed Submit, so what you had written was submitted for you.",
      );
    } catch (e) {
      setError(wordFor(e));
      setBusy(false);
      setConfirm(false);
    }
  }

  const windowMs = Math.max(1, sitting.dueAt - paper.opensAt);
  const leftMs = Math.max(0, sitting.dueAt - now);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="sitting">
      <SittingHeader
        title={paper.title}
        sub={`${totalMarks} marks · closes ${when(sitting.dueAt)}`}
        onBack={() => onDone()}
        backLabel="Leave for now"
        locked
      >
        <TimerRing frac={leftMs / windowMs} leftMs={leftMs} />
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-11 rounded-control bg-gold px-5 text-sm font-medium text-gold-ink"
          data-testid="sitting-submit"
        >
          Offer to teacher
        </button>
      </SittingHeader>

      <div className="flex flex-wrap items-center gap-2">
        {mcq.length > 0 && (
          <LaneBtn
            on={shownLane === "mcq"}
            onClick={() => {
              setLane("mcq");
              setQi(0);
            }}
          >
            MCQ · {counts.m}/{mcq.length}
          </LaneBtn>
        )}
        {long.length > 0 && (
          <LaneBtn
            on={shownLane === "long"}
            onClick={() => {
              setLane("long");
              setQi(0);
            }}
          >
            Writing · {counts.w}/{long.length}
          </LaneBtn>
        )}
        <span className="ml-auto text-xs text-mute">
          {counts.m + counts.w} of {items.length} touched · a sitting, not a scoreboard
        </span>
      </div>

      {q && (
        <div className="flex min-h-0 flex-1 gap-3">
          <Milestone
            count={list.length}
            current={Math.min(qi, list.length - 1)}
            done={list.map(done)}
            onPick={setQi}
          />
          <article className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-card border border-white/80 bg-white/75 p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.14em] text-mute">
              {q.kind === "mcq"
                ? `Question ${qi + 1} · MCQ · 1 mark`
                : `Writing ${qi + 1} · ${q.maxMarks} marks`}{" "}
              · {subjectWord(q.subject)} · {q.topic}
            </p>
            <h3 className="font-display mt-2 text-2xl font-medium leading-snug">{q.text}</h3>
            {q.hasHint && (
              <button
                type="button"
                onClick={() => void showHint(q)}
                className={cn(
                  "mt-4 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs touch:min-h-11",
                  q.kind === "mcq" ? "bg-lilac/40" : "bg-gold/40",
                )}
                data-testid={`hint-button-${q.order}`}
              >
                <Sparkles className="size-3.5" aria-hidden />{" "}
                {q.kind === "mcq"
                  ? "Open this question with the teacher's hint"
                  : "How to think about it"}
              </button>
            )}
            {q.kind === "mcq" ? (
              <fieldset className="mt-5 grid gap-2">
                <legend className="sr-only">{q.text}</legend>
                {q.options.map((opt, i) => {
                  const on = saved(q.order)?.choice === i;
                  return (
                    <label
                      key={i}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center gap-3 rounded-control border px-4 py-3 text-left text-sm transition has-[:focus-visible]:focus-ring",
                        on
                          ? "border-grove bg-mint/50"
                          : "border-white bg-white/80 hover:bg-lilac/20",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`q${q.order}`}
                        checked={on}
                        onChange={() => void keep({ question: q.order, choice: i })}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-chip text-xs font-semibold",
                          on ? "bg-grove text-paper" : "bg-home/5",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <>
                <LongAnswer
                  key={q.order}
                  label={q.text}
                  initial={saved(q.order)?.text ?? ""}
                  onSave={(text) => void keep({ question: q.order, text })}
                  onType={(text) => setTyped((t) => ({ ...t, [q.order]: text }))}
                />
                <p className="mt-2 text-xs text-mute">
                  {textOf(q.order).trim()
                    ? `${textOf(q.order).trim().split(/\s+/).length} words`
                    : "The page is empty. That is fine until you begin."}
                </p>
              </>
            )}

            <div className="mt-6 flex justify-between gap-2">
              <button
                type="button"
                disabled={qi === 0}
                onClick={() => setQi((n) => Math.max(0, n - 1))}
                className="flex h-11 items-center gap-2 rounded-control bg-white/80 px-4 text-sm disabled:opacity-40"
              >
                <ArrowLeft className="size-4" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={qi >= list.length - 1}
                onClick={() => setQi((n) => Math.min(list.length - 1, n + 1))}
                className="flex h-11 items-center gap-2 rounded-control bg-home px-4 text-sm text-paper disabled:opacity-40"
              >
                Next <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
            {done(q) && (
              <p className="mt-3 text-xs text-grove">
                Held. You may still change it until you offer it.
              </p>
            )}
          </article>
        </div>
      )}

      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}

      <Sheet
        open={hintFor !== null}
        onOpenChange={(o) => !o && setHintFor(null)}
        side="right"
        title="DHI"
      >
        {hintFor && (
          <div className="flex min-h-full flex-col">
            <p className="text-xs uppercase tracking-[0.14em] text-mute">A lamp, not an answer</p>
            <p className="mt-2 text-sm text-mute">{hintFor.text}</p>
            <p
              className="font-display mt-6 text-xl leading-relaxed"
              data-testid={`hint-${hintFor.order}`}
            >
              {hints[hintFor.order] ?? "…"}
            </p>
            <p className="mt-auto pt-8 text-xs text-mute">
              Sit with the hint. Choose only when the thought is yours. The hint is your
              teacher&rsquo;s own.
            </p>
          </div>
        )}
      </Sheet>

      <Sheet open={confirm} onOpenChange={setConfirm} side="bottom" title="Good sitting." hideTitle>
        <div className="text-center" data-testid="sitting-confirm">
          <p className="font-display text-3xl">Good sitting.</p>
          <p className="mt-3 text-sm text-mute">
            You touched {counts.m + counts.w} of {items.length} questions ({counts.m} MCQ,{" "}
            {counts.w} writings). Untouched ones stay empty; the teacher reads what you offered, and
            nothing is a punishment.
          </p>
          <p className="mt-3 text-sm text-home/80">
            Now let your teacher review it. Marks come with remarks, and you read them. No rank is
            written on you.
          </p>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="h-11 flex-1 rounded-control bg-white text-sm"
            >
              Return to review
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="h-11 flex-1 rounded-control bg-grove text-sm text-paper disabled:opacity-50"
              data-testid="sitting-offer"
            >
              {busy ? "Offering…" : "Offer the paper"}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

// The window left, as a ring: green, then gold, then red near the end.
function TimerRing({ frac, leftMs }: { frac: number; leftMs: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, frac));
  const color =
    f > 0.4 ? "var(--color-grove)" : f > 0.15 ? "var(--color-gold)" : "var(--color-danger)";
  const h = Math.floor(leftMs / 3_600_000);
  const m = Math.floor((leftMs % 3_600_000) / 60_000);
  const s = Math.floor((leftMs % 60_000) / 1000);
  const text = h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <div
      className="relative grid size-16 place-items-center"
      title="The clock never restarts"
      role="timer"
      aria-label={`Time left: ${text}`}
    >
      <svg viewBox="0 0 56 56" className="size-16 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-sand-deep)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`}
        />
      </svg>
      <span className="absolute flex items-center gap-0.5 text-[10px] font-medium" data-decorative>
        {h === 0 && <Clock className="size-2.5" aria-hidden />}
        {text}
      </span>
    </div>
  );
}

function Milestone({
  count,
  current,
  done,
  onPick,
}: {
  count: number;
  current: number;
  done: boolean[];
  onPick: (i: number) => void;
}) {
  return (
    <div
      className="hidden w-12 shrink-0 flex-col gap-1 overflow-y-auto md:flex"
      aria-label="Questions"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-current={i === current ? "step" : undefined}
          aria-label={`Question ${i + 1}${done[i] ? ", answered" : ""}`}
          className={cn(
            "grid h-8 w-full place-items-center rounded-chip text-[11px]",
            i === current
              ? "bg-home text-paper"
              : done[i]
                ? "bg-mint/70 text-grove"
                : "bg-white/70 text-mute",
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

function LaneBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-10 rounded-full px-4 text-sm touch:h-11",
        on ? "bg-home text-paper" : "bg-white/70",
      )}
    >
      {children}
    </button>
  );
}
