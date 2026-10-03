import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Check,
  Clock,
  Lock,
  Sparkles,
  Square,
  User,
  X,
} from "lucide-react";
import { EXAM_TILES, type ExamTile, type PaperDef } from "@/lib/dhi/papers-demo";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "review" | "submitted";

type Attempt = {
  phase: Phase;
  startedAt: number | null;
  endsAt: number | null;
  mcq: Record<string, number>;
  writing: Record<string, string>;
};

function attemptKey(paperId: string) {
  return `dhi-attempt:${paperId}`;
}

function loadAttempt(paperId: string): Attempt {
  try {
    const raw = localStorage.getItem(attemptKey(paperId));
    if (raw) return JSON.parse(raw) as Attempt;
  } catch {
    /* ignore */
  }
  return { phase: "idle", startedAt: null, endsAt: null, mcq: {}, writing: {} };
}

function saveAttempt(paperId: string, a: Attempt) {
  localStorage.setItem(attemptKey(paperId), JSON.stringify(a));
}

export function PapersDesk({
  locked,
  onLock,
}: {
  locked: boolean;
  onLock: (v: boolean) => void;
}) {
  const [paper, setPaper] = useState<PaperDef | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    for (const tile of EXAM_TILES) {
      if (now <= tile.dueAt) continue;
      const a = loadAttempt(tile.id);
      if (a.phase === "submitted") continue;
      const flag = `dhi-missed:${tile.id}`;
      if (localStorage.getItem(flag)) continue;
      localStorage.setItem(flag, JSON.stringify({ studentId: "stu_suzzy_glass", paperId: tile.id, at: now }));
      setNotice(
        `${tile.subject} window closed. ${tile.teacher} is told you did not sit. Lamps for this week dip — not a rank, a missed sitting.`,
      );
    }
  }, [now]);

  if (!paper) {
    const live = EXAM_TILES.filter((t) => now <= t.dueAt || loadAttempt(t.id).phase === "submitted");
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-mute">
          An exam here is a sitting with a window. When the window closes, the tile leaves your house and the teacher is told.
        </p>
        {notice && (
          <p className="rounded-2xl bg-[#c45c4a]/15 px-4 py-3 text-sm text-[#7a2e24]">{notice}</p>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {live.map((tile) => (
            <ExamCard
              key={tile.id}
              tile={tile}
              now={now}
              onOpen={() => {
                if (tile.paper) setPaper(tile.paper);
                else setNotice(`${tile.subject} is on the board. Questions arrive when ${tile.teacher} opens the sitting.`);
              }}
            />
          ))}
        </div>
        {live.length === 0 && (
          <p className="text-sm text-mute">No open sittings. The house is quiet.</p>
        )}
      </div>
    );
  }

  return (
    <PaperSitting
      paper={paper}
      locked={locked}
      onLock={onLock}
      onBack={() => {
        setPaper(null);
        onLock(false);
      }}
    />
  );
}

function PaperSitting({
  paper,
  locked,
  onLock,
  onBack,
}: {
  paper: PaperDef;
  locked: boolean;
  onLock: (v: boolean) => void;
  onBack: () => void;
}) {
  const [attempt, setAttempt] = useState<Attempt>(() => loadAttempt(paper.id));
  const [lane, setLane] = useState<"mcq" | "write">("mcq");
  const [qi, setQi] = useState(0);
  const [hintId, setHintId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    saveAttempt(paper.id, attempt);
    const freeze = attempt.phase === "idle" || attempt.phase === "running" || attempt.phase === "review";
    onLock(freeze);
  }, [attempt, paper.id, onLock]);

  useEffect(() => {
    if (attempt.phase !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt.phase]);

  useEffect(() => {
    if (attempt.phase === "running" && attempt.endsAt && now >= attempt.endsAt) {
      setAttempt((a) => ({ ...a, phase: "review" }));
      setShowSubmit(true);
    }
  }, [now, attempt.phase, attempt.endsAt]);

  const totalMs = paper.durationMin * 60 * 1000;
  const leftMs = attempt.endsAt ? Math.max(0, attempt.endsAt - now) : totalMs;
  const frac = attempt.phase === "idle" ? 1 : leftMs / totalMs;
  const ring = frac > 0.4 ? "green" : frac > 0.15 ? "yellow" : "red";

  const mcq = paper.mcq[qi] ?? paper.mcq[0];
  const write = paper.writing[qi] ?? paper.writing[0];
  const list = lane === "mcq" ? paper.mcq : paper.writing;
  const answered =
    lane === "mcq" ? attempt.mcq[mcq.id] !== undefined : (attempt.writing[write.id] ?? "").trim().length > 0;

  const doneCount = useMemo(() => {
    const m = paper.mcq.filter((q) => attempt.mcq[q.id] !== undefined).length;
    const w = paper.writing.filter((q) => (attempt.writing[q.id] ?? "").trim()).length;
    return { m, w, t: m + w, all: paper.mcq.length + paper.writing.length };
  }, [attempt, paper]);

  function start() {
    const startedAt = Date.now();
    setAttempt((a) => ({
      ...a,
      phase: "running",
      startedAt: a.startedAt ?? startedAt,
      endsAt: a.endsAt ?? startedAt + totalMs,
    }));
  }

  function stop() {
    setAttempt((a) => ({ ...a, phase: "review" }));
    setShowSubmit(true);
  }

  function submit() {
    setAttempt((a) => ({ ...a, phase: "submitted" }));
    setShowSubmit(false);
    onLock(false);
  }

  const canWrite = attempt.phase === "running" || attempt.phase === "review";
  const hintQ =
    paper.mcq.find((q) => q.id === hintId) ?? paper.writing.find((q) => q.id === hintId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="rounded-[24px] border border-white/80 bg-white/75 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={attempt.phase === "running"}
            title={attempt.phase === "running" ? "Exam is going on — stop first" : "Back to exams"}
            className="grid size-10 place-items-center rounded-2xl bg-white/80 disabled:opacity-40"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{paper.institute}</p>
            <h2 className="font-display text-2xl font-medium">{paper.subject}</h2>
            <p className="text-sm text-mute">
              {paper.teacher} · {paper.date} · {paper.totalMarks} marks · {paper.durationMin} min
            </p>
          </div>
          <TimerRing frac={frac} ring={ring} leftMs={attempt.phase === "idle" ? totalMs : leftMs} />
          {attempt.phase === "idle" && (
            <button
              type="button"
              onClick={start}
              className="h-11 rounded-2xl bg-grove px-5 text-sm font-medium text-paper"
            >
              Start sitting
            </button>
          )}
          {attempt.phase === "running" && (
            <button
              type="button"
              onClick={stop}
              className="flex h-11 items-center gap-2 rounded-2xl bg-[#c45c4a] px-4 text-sm font-medium text-paper"
            >
              <Square className="size-3.5 fill-current" />
              Stop
            </button>
          )}
          {attempt.phase === "review" && (
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="h-11 rounded-2xl bg-gold px-5 text-sm font-medium text-gold-ink"
            >
              Offer to teacher
            </button>
          )}
          {attempt.phase === "submitted" && (
            <button
              type="button"
              onClick={() => {
                const fresh: Attempt = { phase: "idle", startedAt: null, endsAt: null, mcq: {}, writing: {} };
                localStorage.removeItem(attemptKey(paper.id));
                setAttempt(fresh);
              }}
              className="h-11 rounded-2xl bg-home px-5 text-sm font-medium text-paper"
            >
              Sit again
            </button>
          )}
        </div>
        {locked && (
          <p className="mt-3 flex items-center gap-2 text-xs text-mute">
            <Lock className="size-3.5" /> The house is quiet. Only this paper, until you stop.
          </p>
        )}
      </header>

      {attempt.phase === "idle" ? (
        <IdleCard paper={paper} onStart={start} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <LaneBtn on={lane === "mcq"} onClick={() => { setLane("mcq"); setQi(0); }}>
              MCQ · {doneCount.m}/{paper.mcq.length}
            </LaneBtn>
            <LaneBtn on={lane === "write"} onClick={() => { setLane("write"); setQi(0); }}>
              Writing · {doneCount.w}/{paper.writing.length}
            </LaneBtn>
            <span className="ml-auto text-xs text-mute">
              {doneCount.t} of {doneCount.all} touched · a sitting, not a scoreboard
            </span>
          </div>

          <div className="flex min-h-0 flex-1 gap-3">
            <Milestone
              count={list.length}
              current={qi}
              done={list.map((q) =>
                lane === "mcq"
                  ? attempt.mcq[(q as (typeof paper.mcq)[0]).id] !== undefined
                  : Boolean((attempt.writing[(q as (typeof paper.writing)[0]).id] ?? "").trim()),
              )}
              onPick={setQi}
            />

            <article className="min-w-0 flex-1 overflow-y-auto rounded-[24px] border border-white/80 bg-white/75 p-5 backdrop-blur-xl">
              {lane === "mcq" ? (
                <McqCard
                  q={mcq}
                  choice={attempt.mcq[mcq.id]}
                  disabled={!canWrite || attempt.phase === "submitted"}
                  onChoose={(i) => setAttempt((a) => ({ ...a, mcq: { ...a.mcq, [mcq.id]: i } }))}
                  onHint={() => setHintId(mcq.id)}
                />
              ) : (
                <WriteCard
                  q={write}
                  value={attempt.writing[write.id] ?? ""}
                  disabled={!canWrite || attempt.phase === "submitted"}
                  onChange={(v) => setAttempt((a) => ({ ...a, writing: { ...a.writing, [write.id]: v } }))}
                  onHint={() => setHintId(write.id)}
                />
              )}

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  disabled={qi === 0}
                  onClick={() => setQi((n) => Math.max(0, n - 1))}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-white/80 px-4 text-sm disabled:opacity-40"
                >
                  <ArrowLeft className="size-4" /> Previous
                </button>
                <button
                  type="button"
                  disabled={qi >= list.length - 1}
                  onClick={() => setQi((n) => Math.min(list.length - 1, n + 1))}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-home px-4 text-sm text-paper disabled:opacity-40"
                >
                  Next <ArrowRight className="size-4" />
                </button>
              </div>
              {answered && <p className="mt-3 text-xs text-grove">Held. You may still change it until you offer it.</p>}
            </article>
          </div>
        </>
      )}

      {hintQ && <HintSlider title={hintQ.prompt} body={hintQ.hint} onClose={() => setHintId(null)} />}

      {showSubmit && attempt.phase !== "submitted" && (
        <SubmitModal
          paper={paper}
          done={doneCount}
          onStay={() => setShowSubmit(false)}
          onOffer={submit}
        />
      )}

      {attempt.phase === "submitted" && (
        <p className="rounded-2xl bg-mint/40 px-4 py-3 text-sm text-grove">
          Well sat. Shubham Raj will read with remarks — not a stamp of worth. The lamp moves after you accept his note.
        </p>
      )}
    </div>
  );
}

function ExamCard({
  tile,
  now,
  onOpen,
}: {
  tile: ExamTile;
  now: number;
  onOpen: () => void;
}) {
  const windowMs = Math.max(1, tile.dueAt - tile.assignedAt);
  const fill = Math.min(1, Math.max(0, (now - tile.assignedAt) / windowMs));
  const left = Math.max(0, tile.dueAt - now);
  const tone = fill < 0.5 ? "green" : fill < 0.8 ? "yellow" : "red";
  const wash =
    tone === "green" ? "bg-grove" : tone === "yellow" ? "bg-gold" : "bg-[#c45c4a]";
  const submitted = loadAttempt(tile.id).phase === "submitted";

  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/75 shadow-sm backdrop-blur-xl">
      <div
        className={cn("pointer-events-none absolute inset-x-0 bottom-0 opacity-30 transition-all duration-1000", wash)}
        style={{ height: `${Math.round(fill * 100)}%` }}
      />
      <div className="relative z-10 flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{tile.institute}</p>
            <h2 className="font-display mt-1 text-2xl font-medium">{tile.subject}</h2>
            <p className="mt-1 text-sm text-mute">{tile.title}</p>
          </div>
          <FlipClock dueAt={tile.dueAt} now={now} />
        </div>

        <p className="text-sm leading-relaxed text-home/75">{tile.blurb}</p>

        <p className="flex items-center gap-2 text-sm">
          <span className="grid size-8 place-items-center rounded-xl bg-white/80">
            <User className="size-4 text-mute" />
          </span>
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-mute">Teacher</span>
            {tile.teacher}
          </span>
        </p>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Meta icon={Calendar} label="Date" value={tile.date} />
          <Meta icon={Clock} label="Sitting" value={`${tile.durationMin} min`} />
          <Meta icon={Award} label="Marks" value={`${tile.totalMarks}`} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-mute">
            {submitted
              ? "Offered to the teacher"
              : tone === "red"
                ? "Window almost shut — sit today"
                : tone === "yellow"
                  ? "The day is moving. Sit when you can be quiet."
                  : "Plenty of sky left in this window."}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="h-11 shrink-0 rounded-2xl bg-home px-5 text-sm font-medium text-paper"
          >
            Open sitting
          </button>
        </div>
      </div>
    </article>
  );
}

function FlipClock({ dueAt, now }: { dueAt: number; now: number }) {
  const left = Math.max(0, dueAt - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const units = [
    { n: d, label: "Days" },
    { n: h, label: "Hours" },
    { n: m, label: "Min" },
    { n: s, label: "Sec" },
  ];
  return (
    <div className="flex gap-1" aria-label="Time left to sit">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-home px-1.5 font-display text-sm tabular-nums text-paper">
            {String(u.n).padStart(2, "0")}
          </span>
          <span className="mt-0.5 text-[8px] uppercase tracking-wider text-mute">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-2 py-2">
      <Icon className="size-3.5 shrink-0 text-mute" />
      <span>
        <span className="block text-[9px] uppercase tracking-wide text-mute">{label}</span>
        <span className="font-medium">{value}</span>
      </span>
    </div>
  );
}

function IdleCard({ paper, onStart }: { paper: PaperDef; onStart: () => void }) {
  return (
    <article className="rounded-[24px] border border-white/80 bg-white/70 p-8 text-center backdrop-blur-xl">
      <p className="font-display text-3xl">A quiet pariksha</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-mute">
        {paper.mcq.length} short questions and {paper.writing.length} writings. When you start, the rest of the house
        locks so the mind can stay here. DHI may open a question — never the answer. Timer does not restart.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 h-12 rounded-2xl bg-grove px-8 text-sm font-medium text-paper"
      >
        I am ready to sit
      </button>
    </article>
  );
}

function McqCard({
  q,
  choice,
  disabled,
  onChoose,
  onHint,
}: {
  q: PaperDef["mcq"][number];
  choice: number | undefined;
  disabled: boolean;
  onChoose: (i: number) => void;
  onHint: () => void;
}) {
  const letters = ["A", "B", "C", "D"];
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-mute">Question {q.n} · MCQ · 2 marks</p>
      <h3 className="font-display mt-2 text-2xl font-medium leading-snug">{q.prompt}</h3>
      <button
        type="button"
        onClick={onHint}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-lilac/40 px-3 py-1.5 text-xs"
      >
        <Sparkles className="size-3.5" /> Ask DHI to open this question
      </button>
      <div className="mt-5 grid gap-2">
        {q.options.map((opt, i) => {
          const on = choice === i;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(i)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
                on ? "border-grove bg-mint/50" : "border-white bg-white/80 hover:bg-lilac/20",
                disabled && "opacity-80",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl text-xs font-semibold",
                  on ? "bg-grove text-paper" : "bg-home/5",
                )}
              >
                {letters[i]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WriteCard({
  q,
  value,
  disabled,
  onChange,
  onHint,
}: {
  q: PaperDef["writing"][number];
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onHint: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <p className="text-xs uppercase tracking-[0.14em] text-mute">
        Writing {q.n} · {q.marks} marks
      </p>
      <h3 className="font-display mt-2 text-2xl font-medium leading-snug">{q.prompt}</h3>
      <button
        type="button"
        onClick={onHint}
        className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-gold/40 px-3 py-1.5 text-xs"
      >
        <Sparkles className="size-3.5" /> Ask DHI how to think
      </button>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write as you would to a younger student in the courtyard. Slow is allowed."
        className="mt-5 min-h-56 flex-1 resize-y rounded-2xl border border-white bg-white/90 p-4 text-sm leading-relaxed outline-none placeholder:text-mute"
      />
      <p className="mt-2 text-xs text-mute">{value.trim() ? `${value.trim().split(/\s+/).length} words` : "The page is empty. That is fine until you begin."}</p>
    </div>
  );
}

function HintSlider({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-home/20 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md animate-[slideIn_280ms_ease] flex-col border-l border-white/60 bg-[#f7f1e8]/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="size-4 text-gold-ink" /> DHI
          </p>
          <button type="button" aria-label="Close DHI" onClick={onClose} className="grid size-10 place-items-center rounded-2xl bg-white">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.14em] text-mute">A lamp, not an answer</p>
        <p className="mt-2 text-sm text-mute">{title}</p>
        <p className="font-display mt-6 text-xl leading-relaxed">{body}</p>
        <p className="mt-auto pt-8 text-xs text-mute">
          Sit with the hint. Choose only when the thought is yours.
        </p>
      </aside>
      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}

function SubmitModal({
  paper,
  done,
  onStay,
  onOffer,
}: {
  paper: PaperDef;
  done: { m: number; w: number; t: number; all: number };
  onStay: () => void;
  onOffer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-home/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-[#f7f1e8] p-6 text-center shadow-2xl">
        <p className="font-display text-3xl">Good sitting.</p>
        <p className="mt-3 text-sm text-mute">
          You touched {done.t} of {done.all} questions ({done.m} MCQ, {done.w} writings). Untouched ones stay empty —
          the teacher reads what you offered, not a punishment.
        </p>
        <p className="mt-3 text-sm text-home/80">
          Now let {paper.teacher} review it. Marks will come with remarks. You will accept them. No rank is written on
          you.
        </p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onStay} className="h-11 flex-1 rounded-2xl bg-white text-sm">
            Return to review
          </button>
          <button type="button" onClick={onOffer} className="h-11 flex-1 rounded-2xl bg-grove text-sm text-paper">
            Offer the paper
          </button>
        </div>
      </div>
    </div>
  );
}

function TimerRing({ frac, ring, leftMs }: { frac: number; ring: string; leftMs: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, frac));
  const color = ring === "green" ? "#2f6b3a" : ring === "yellow" ? "#e8c36a" : "#c45c4a";
  const m = Math.floor(leftMs / 60000);
  const s = Math.floor((leftMs % 60000) / 1000);
  return (
    <div className="relative grid size-16 place-items-center" title="Timer never restarts">
      <svg viewBox="0 0 56 56" className="size-16 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#efeaf6" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute flex items-center gap-0.5 text-[10px] font-medium">
        <Clock className="size-2.5" />
        {m}:{String(s).padStart(2, "0")}
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
    <div className="hidden w-12 shrink-0 flex-col gap-1 overflow-y-auto md:flex">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          className={cn(
            "grid h-8 w-full place-items-center rounded-xl text-[11px]",
            i === current ? "bg-home text-paper" : done[i] ? "bg-mint/70 text-grove" : "bg-white/70 text-mute",
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

function LaneBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-10 rounded-full px-4 text-sm", on ? "bg-home text-paper" : "bg-white/70")}
    >
      {children}
    </button>
  );
}
