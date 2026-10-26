// The exams room, the student's side (spec house/0012). The list shows each paper sent to the student with its window and status. A paper opens
// for a sitting inside its window: the questions show with saved answers, and Submit ends it. While a sitting is open the rest of the house is
// locked; the lock is client side only, as the spec says (the server never depends on it). A student can ask for a question's hint, which helps
// them think and never gives the answer. A mark shows only after the teacher has confirmed it, and the student can accept the feedback once.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import type { GenericId } from "convex/values";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

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
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// How long a student can stop typing in a long answer before it is kept. Leaving the box keeps it at once.
const KEEP_AFTER_MS = 4000;

export function ExamsRoom({ onSitting }: { onSitting?: (locked: boolean) => void }) {
  const papers = useQuery(api.papers.mine, {});
  const [sitting, setSitting] = useState<GenericId<"paperAttempts"> | null>(null);
  const [sittingOpen, setSittingOpen] = useState(false);
  const [note, setNote] = useState("");

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
        attemptId={sitting}
        onDone={(after) => {
          setNote(after ?? "");
          setSitting(null);
        }}
        onOpen={setSittingOpen}
      />
    );
  }
  if (papers === undefined) return <p className="text-sm text-mute">Loading your papers…</p>;
  if (papers.length === 0) return <Notice className="px-4 py-3 text-sm">No papers yet. When your teacher sends one, it appears here.</Notice>;

  return (
    <div className="space-y-3" data-testid="exams-room">
      {note && (
        <Notice role="status" className="px-4 py-3 text-sm" data-testid="exam-note">
          {note}
        </Notice>
      )}
      {papers.map((p) => (
        <PaperRow key={p.attemptId} paper={p} onStart={() => setSitting(p.attemptId)} />
      ))}
    </div>
  );
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

function PaperRow({ paper, onStart }: { paper: Row; onStart: () => void }) {
  const now = Date.now();
  const inWindow = now >= paper.opensAt && now < paper.dueAt;
  const start = useMutation(api.exams.start);
  const accept = useMutation(api.exams.acceptFeedback);
  const [error, setError] = useState("");
  const canStart = paper.status === "assigned" && inWindow;
  const continueSitting = paper.status === "open" && inWindow;

  async function begin() {
    setError("");
    try {
      const r = await start({ attemptId: paper.attemptId });
      if (!r.ok) setError(WORDS[r.code] ?? "This paper is not open.");
      else onStart();
    } catch (e) {
      setError(wordFor(e));
    }
  }

  async function acceptIt() {
    setError("");
    try {
      const r = await accept({ attemptId: paper.attemptId });
      if (!r.ok) setError(WORDS[r.code] ?? "We could not save that.");
    } catch (e) {
      setError(wordFor(e));
    }
  }

  return (
    <Card className="space-y-2" data-testid="exam-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{paper.title}</h2>
        <span className="text-xs text-mute">{paper.excused ? "Not sat: the class was paused" : statusWords(paper.status, inWindow, now < paper.opensAt)}</span>
      </div>
      <p className="text-xs text-mute">
        Opens {when(paper.opensAt)} · closes {when(paper.dueAt)}
      </p>
      {paper.mark && (
        <>
          <p className="text-sm" data-testid="exam-mark">
            Mark {paper.mark.total} of {paper.mark.maxTotal}
            {paper.mark.remarks ? `. ${paper.mark.remarks}` : ""}
          </p>
          {paper.accepted ? (
            <p className="text-xs text-mute" data-testid="exam-accepted">
              You have read this feedback.
            </p>
          ) : (
            <Button variant="quiet" onClick={acceptIt} data-testid="exam-accept">
              I have read this feedback
            </Button>
          )}
        </>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      {canStart && <Button onClick={begin}>Start paper</Button>}
      {continueSitting && (
        <Button onClick={onStart} data-testid="exam-continue">
          Continue paper
        </Button>
      )}
    </Card>
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

// A long answer. What the student types is kept a few seconds after they pause, when they leave the box, and when they leave the screen, so a
// closed tab or a window that ends costs at most the last few seconds. `onSave` is read through a ref so a new function on each render does not
// keep what was typed over and over.
function LongAnswer({ label, initial, onSave }: { label: string; initial: string; onSave: (text: string) => void }) {
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
      className="w-full rounded-control border border-home/15 bg-white/80 p-3 text-sm"
      rows={6}
      maxLength={2000}
      value={text}
      onChange={(e) => {
        latest.current = e.target.value;
        setText(e.target.value);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, KEEP_AFTER_MS);
      }}
      onBlur={flush}
      aria-label={label}
    />
  );
}

// One sitting: the questions and the answers so far. Each answer is saved as it is given. The window's end submits the paper on the server.
function Sitting({ attemptId, onDone, onOpen }: { attemptId: GenericId<"paperAttempts">; onDone: (note?: string) => void; onOpen: (open: boolean) => void }) {
  const sitting = useQuery(api.exams.questions, { attemptId });
  const answer = useMutation(api.exams.answer);
  const submit = useMutation(api.exams.submit);
  const askHint = useMutation(api.exams.hint);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState<Record<number, string>>({});
  const isOpen = sitting?.open === true;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Tells the room whether the sitting is open, which keeps the rest of the house locked.
  useEffect(() => {
    onOpen(isOpen);
    return () => onOpen(false);
  }, [isOpen, onOpen]);

  if (sitting === undefined) return <p className="text-sm text-mute">Opening the paper…</p>;
  if (!sitting.open) {
    return (
      <Card className="space-y-3">
        <p className="text-sm">This paper is closed now. Anything you had written was submitted when its time ended.</p>
        <Button variant="quiet" onClick={() => onDone()}>
          Back to papers
        </Button>
      </Card>
    );
  }

  const saved = (question: number) => sitting.answers.find((a) => a.question === question);

  // The server answers a refused save with a code rather than an error, so the code is read here too.
  async function keep(payload: { question: number; choice?: number; text?: string }) {
    setError("");
    try {
      const r = await answer({ attemptId, ...payload });
      if (!r.ok) setError(WORDS[r.code] ?? "Your answer was not saved.");
    } catch (e) {
      setError(wordFor(e));
    }
  }
  const choose = (question: number, choice: number) => keep({ question, choice });
  const write = (question: number, text: string) => keep({ question, text });

  async function showHint(question: number) {
    setError("");
    try {
      const r = await askHint({ attemptId, question });
      if (r.ok) setHints((h) => ({ ...h, [question]: r.text }));
      else setError(WORDS[r.code] ?? "We could not show the hint.");
    } catch (e) {
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
        return;
      }
      // The window ended a moment before the press: the server has already submitted what was written, and the student is told so.
      onDone(r.ok ? undefined : "Time ended just before you pressed Submit, so what you had written was submitted for you.");
    } catch (e) {
      setError(wordFor(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="sitting">
      <p className="text-sm text-mute">Closes at {when(sitting.dueAt)}. Your answers are saved as you go. {now >= sitting.dueAt ? "Time is over." : ""}</p>
      {sitting.items.map((q) => (
        <Card key={q.order} className="space-y-2">
          <p className="text-xs text-mute">
            {q.subject} · {q.topic}
          </p>
          <p className="text-sm font-medium">{q.text}</p>
          {q.kind === "mcq" ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">{q.text}</legend>
              {q.options.map((opt, i) => (
                <label key={i} className="flex min-h-9 touch:min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name={`q${q.order}`} checked={saved(q.order)?.choice === i} onChange={() => choose(q.order, i)} />
                  {opt}
                </label>
              ))}
            </fieldset>
          ) : (
            <LongAnswer label={q.text} initial={saved(q.order)?.text ?? ""} onSave={(text) => write(q.order, text)} />
          )}
          {q.hasHint &&
            (hints[q.order] === undefined ? (
              <Button variant="quiet" onClick={() => showHint(q.order)} data-testid={`hint-button-${q.order}`}>
                Show a hint
              </Button>
            ) : (
              <Notice className="px-4 py-3 text-sm" data-testid={`hint-${q.order}`}>
                Hint: {hints[q.order]}
              </Notice>
            ))}
        </Card>
      ))}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="flex gap-2">
        <Button onClick={finish} disabled={busy} data-testid="sitting-submit">
          Submit paper
        </Button>
        <Button variant="quiet" onClick={() => onDone()}>
          Leave for now
        </Button>
      </div>
    </div>
  );
}
