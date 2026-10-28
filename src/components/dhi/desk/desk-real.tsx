// The DHI desk (spec house/0016). A signed in student asks a study question, spends a coin from their wallet, and keeps the talk. The server holds
// the wallet, the talks and the answers: this screen reads them with `desk.wallet`, `desk.threads` and `desk.thread` and asks through `deskAsk.ask`.
// A repeated question is answered from the stored answer for nothing, and a message that sounds like distress gets the care words and is stored nowhere.
// Answers are shown as plain text, never as markup.
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { DEFAULT_MONTHLY_COINS, QUESTION_MAX, WRITE_MAX } from "@dhi/backend/deskRules";
import {
  ASK,
  ASKING,
  ASK_LABEL,
  ASK_PLACEHOLDER,
  CARE_TEXT,
  CLARIFY,
  COINS_LABEL,
  COINS_SPENT,
  COIN_NOTE,
  DELETE_TALK,
  DESK_WORDS_APPROVED,
  DRAW_ALT,
  DRAW_BUTTON,
  DRAW_LABEL,
  DRAW_NOTE,
  DRAW_PLACEHOLDER,
  DRAFT_NOTE,
  FROM_STORE,
  LOADING,
  MODE_ASK,
  MOCK_BUTTON,
  MOCK_NOTE,
  MODE_DRAW,
  MODE_MOCK,
  MODE_PAPER,
  MODE_STORY,
  MODE_WRITE,
  MODEL_NOTE,
  STORY_BUTTON,
  STORY_LABEL,
  STORY_NOTE,
  PAPER_BUTTON,
  PAPER_LABEL,
  PAPER_NOTE,
  PAPER_PLACEHOLDER,
  NEW_TALK,
  NO_TALKS,
  OFF_NOTE,
  TALKS_TITLE,
  WRITE_BUTTON,
  WRITE_LABEL,
  WRITE_NOTE,
  WRITE_PLACEHOLDER,
  deskRefusal,
  MODE_USE,
  USE_NOTE,
} from "@/lib/dhi/desk-words";
import { DeskFeelingCard } from "@/components/dhi/desk/desk-feeling-card";
import { LearnPanel } from "@/components/dhi/desk/learn-panel";
import { RESOLVED, RESOLVED_DONE, TAB_ASK, TAB_LEARN, USE_IT } from "@/lib/dhi/learn-words";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { useStudent } from "@/lib/dhi/student";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Mic, MicOff, Plus, Search, Send, Sparkles, X } from "lucide-react";

// The three ways to ask: what each one is called, its box and its button. `max` is the same limit the server holds.
const MODES = {
  chat: {
    tab: MODE_ASK,
    label: ASK_LABEL,
    placeholder: ASK_PLACEHOLDER,
    button: ASK,
    max: QUESTION_MAX,
    rows: 3,
    note: null as string | null,
  },
  write: {
    tab: MODE_WRITE,
    label: WRITE_LABEL,
    placeholder: WRITE_PLACEHOLDER,
    button: WRITE_BUTTON,
    max: WRITE_MAX,
    rows: 8,
    note: WRITE_NOTE as string | null,
  },
  paper: {
    tab: MODE_PAPER,
    label: PAPER_LABEL,
    placeholder: PAPER_PLACEHOLDER,
    button: PAPER_BUTTON,
    max: QUESTION_MAX,
    rows: 3,
    note: PAPER_NOTE as string | null,
  },
  mock: {
    tab: MODE_MOCK,
    label: PAPER_LABEL,
    placeholder: PAPER_PLACEHOLDER,
    button: MOCK_BUTTON,
    max: QUESTION_MAX,
    rows: 3,
    note: MOCK_NOTE as string | null,
  },
  story: {
    tab: MODE_STORY,
    label: STORY_LABEL,
    placeholder: PAPER_PLACEHOLDER,
    button: STORY_BUTTON,
    max: QUESTION_MAX,
    rows: 3,
    note: STORY_NOTE as string | null,
  },
  draw: {
    tab: MODE_DRAW,
    label: DRAW_LABEL,
    placeholder: DRAW_PLACEHOLDER,
    button: DRAW_BUTTON,
    max: QUESTION_MAX,
    rows: 3,
    note: DRAW_NOTE as string | null,
  },
  // Use it (house spec 0031): where a topic shows up in daily life, stored and reused for the institute.
  use: {
    tab: MODE_USE,
    label: STORY_LABEL,
    placeholder: PAPER_PLACEHOLDER,
    button: USE_IT,
    max: QUESTION_MAX,
    rows: 3,
    note: USE_NOTE as string | null,
  },
};
type Mode = keyof typeof MODES;

// A diagram is shown through an image tag, which never runs a script, and only after the server has checked it.
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function DeskReal() {
  const wallet = useQuery(api.desk.wallet, {});
  const threads = useQuery(api.desk.threads, {});
  // The after session card is read here too (the same query, shared with the card), so the room draws once with it and the desk below never jumps.
  const pendingCard = useQuery(api.deskSitting.pending, {});
  const openWallet = useMutation(api.desk.open);
  const removeThread = useMutation(api.desk.removeThread);
  const resolve = useMutation(api.desk.resolve);
  const [tab, setTab] = useState<"ask" | "learn">("ask");
  const ask = useAction(api.deskAsk.ask);
  const [threadId, setThreadId] = useState<string | null>(null);
  const talk = useQuery(api.desk.thread, threadId ? { threadId } : "skip");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [care, setCare] = useState(false);
  const [q, setQ] = useState("");
  const [canvasOn, setCanvasOn] = useState(true);
  const student = useStudent();
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLLIElement>(null);
  // The class's topics, read once with the screen's clock, so the starters can offer the topic the student most needs.
  const [now] = useState(() => Date.now());
  const topics = useQuery(api.learn.map, { now });
  const suggestion = useMemo(() => (topics ? suggestTopic(topics) : null), [topics]);
  // The newest turn stays in view as the talk grows.
  const turnCount = talk?.turns.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turnCount, busy]);

  // Making the wallet and adding the month's coins happens when the desk opens; the reactive `wallet` query then shows the balance.
  useEffect(() => {
    void openWallet({}).catch(() => {});
  }, [openWallet]);

  async function send(kind: Mode | "clarify") {
    if (busy || text.trim().length === 0) return;
    setBusy(true);
    setFail("");
    setCare(false);
    try {
      const r = await ask({ kind, question: text, ...(threadId ? { threadId } : {}) });
      if (!r.ok) {
        setFail(deskRefusal(r.code));
      } else if (r.care) {
        setCare(true);
        setText("");
      } else {
        setThreadId(r.threadId);
        setText("");
      }
    } catch (error) {
      setFail(deskRefusal(error));
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setFail("");
    try {
      const r = await removeThread({ threadId: id });
      if (!r.ok) setFail(deskRefusal(r.code));
      else if (id === threadId) setThreadId(null);
    } catch (error) {
      setFail(deskRefusal(error));
    }
  }

  if (wallet === undefined || threads === undefined || pendingCard === undefined) {
    return (
      <p className="text-sm text-mute" data-testid="desk-loading">
        {LOADING}
      </p>
    );
  }

  const shownTalks = q.trim()
    ? threads.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase()))
    : threads;
  const turns = talk?.turns ?? [];
  const lastDrawing = [...turns]
    .reverse()
    .find((x) => x.kind === "draw" && x.status === "answered" && x.answer !== null);
  const showCanvas = canvasOn && lastDrawing !== undefined;
  const firstName = student.name.split(" ")[0] || student.name;
  // The coins bar: what is left of the month's coins, never below a sliver so it stays visible.
  const monthly = Math.max(wallet.balance, DEFAULT_MONTHLY_COINS);
  const left = Math.max(6, Math.round((wallet.balance / monthly) * 100));

  function startWith(kind: Mode) {
    setMode(kind);
    setFail("");
    // The topic is picked by the house's own rule first (a recall due, then a topic with a wrong answer to fix); the model only answers it.
    if (kind !== "chat" && kind !== "write" && suggestion) setText(suggestion.name);
    input.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="desk-room">
      {!DESK_WORDS_APPROVED && (
        <p className="text-xs text-mute touch:text-sm" data-testid="desk-draft">
          {DRAFT_NOTE}
        </p>
      )}
      {!wallet.live && (
        <Notice role="status" data-testid="desk-off" className="px-4 py-3 text-sm">
          {OFF_NOTE}
        </Notice>
      )}
      <DeskFeelingCard />
      <div className="flex flex-wrap gap-2" role="group" data-testid="desk-tabs">
        {(["ask", "learn"] as const).map((x) => (
          <Button
            key={x}
            variant={tab === x ? "solid" : "quiet"}
            aria-pressed={tab === x}
            onClick={() => setTab(x)}
            data-testid={`desk-tab-${x}`}
          >
            {x === "ask" ? TAB_ASK : TAB_LEARN}
          </Button>
        ))}
      </div>
      {tab === "learn" ? (
        <LearnPanel live={wallet.live} />
      ) : (
        <div className="grid min-h-[34rem] grid-cols-1 gap-3 lg:h-[calc(100dvh-13rem)] lg:min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_260px]">
          <section
            className={cn(
              "grid min-h-0 min-w-0 grid-cols-1 overflow-hidden rounded-panel border border-white/80 bg-white/65 shadow-sm backdrop-blur-xl",
              showCanvas && "lg:grid-cols-2",
            )}
          >
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                {turns.length === 0 && !busy ? (
                  <div className="flex min-h-full flex-col items-center justify-center text-center">
                    <div className="relative mb-3 grid size-14 place-items-center" aria-hidden>
                      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-lilac via-peach to-gold opacity-70 blur-md" />
                      <span className="relative grid size-12 place-items-center rounded-full bg-white text-gold-ink shadow-sm">
                        <Sparkles className="size-6" />
                      </span>
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl">Welcome, {firstName}</h2>
                    <p className="mt-2 text-sm text-mute">How shall we sit today?</p>
                    <div
                      className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      data-testid="desk-starters"
                    >
                      {STARTERS.map((s) => (
                        <button
                          key={s.kind}
                          type="button"
                          onClick={() => startWith(s.kind)}
                          className="rounded-card bg-white p-4 text-left shadow-sm hover:shadow"
                          data-testid={`desk-starter-${s.kind}`}
                        >
                          <p className="text-sm font-medium">{s.title}</p>
                          <p className="mt-1 text-xs text-mute">{s.body}</p>
                          {s.kind !== "chat" && s.kind !== "write" && suggestion && (
                            <p className="mt-2 text-[11px] text-grove touch:text-xs">
                              {suggestion.due
                                ? "Due for recall"
                                : suggestion.openFix > 0
                                  ? "Has an answer to fix"
                                  : "From your class"}
                              : {suggestion.name}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ol className="space-y-4" data-testid="desk-turns">
                    {turns.map((x) => (
                      <li key={x.id} className="space-y-2">
                        <p className="ml-auto w-fit max-w-[92%] whitespace-pre-wrap rounded-card bg-home px-4 py-3 text-sm text-paper">
                          {x.question}
                        </p>
                        <article className="max-w-[92%] rounded-card bg-white px-4 py-3 text-sm text-home shadow-sm">
                          <p className="mb-1 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-mute touch:text-xs">
                            <span aria-hidden>✦</span> DHI
                            {x.status === "answered" && (
                              <span className="normal-case tracking-normal">
                                · {x.cached ? FROM_STORE : COINS_SPENT(x.coinsSpent)}
                              </span>
                            )}
                          </p>
                          {x.status === "answered" && x.answer !== null && x.kind === "draw" ? (
                            <button
                              type="button"
                              onClick={() => setCanvasOn(true)}
                              className="block w-full"
                              aria-label="Open the diagram on the canvas"
                            >
                              <img
                                src={svgUrl(x.answer)}
                                alt={DRAW_ALT}
                                className="w-full max-w-md rounded-control bg-paper"
                                data-testid="desk-diagram"
                              />
                            </button>
                          ) : x.status === "answered" && x.answer !== null ? (
                            <p
                              className="whitespace-pre-wrap leading-relaxed"
                              data-testid="desk-answer"
                            >
                              {x.answer}
                            </p>
                          ) : x.status === "pending" ? (
                            <p className="text-mute">{ASKING}</p>
                          ) : null}
                          {x.status === "answered" && x.kind === "chat" && (
                            <p className="mt-2 text-xs text-mute">
                              {x.resolved ? (
                                <span data-testid="desk-resolved">{RESOLVED_DONE}</span>
                              ) : (
                                <Button
                                  variant="link"
                                  onClick={() => void resolve({ turnId: x.id }).catch(() => {})}
                                  data-testid="desk-resolve"
                                >
                                  {RESOLVED}
                                </Button>
                              )}
                            </p>
                          )}
                        </article>
                      </li>
                    ))}
                    {busy && (
                      <li className="flex items-center gap-3 rounded-card bg-white px-4 py-3 text-sm shadow-sm">
                        <span className="dhi-sit text-gold-ink" aria-hidden>
                          <span>●</span>
                          <span className="mx-0.5">●</span>
                          <span>●</span>
                        </span>
                        <span className="text-mute">{ASKING}</span>
                      </li>
                    )}
                    <li ref={end} aria-hidden />
                  </ol>
                )}
              </div>

              <div className="space-y-2 border-t border-home/5 p-3 sm:p-4">
                {care && (
                  <Notice role="status" data-testid="desk-care" className="px-4 py-3 text-sm">
                    {CARE_TEXT}
                  </Notice>
                )}
                {fail && (
                  <Notice
                    tone="danger"
                    role="alert"
                    data-testid="desk-error"
                    className="px-4 py-3 text-sm"
                  >
                    {fail}
                  </Notice>
                )}
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  role="group"
                  data-testid="desk-modes"
                  data-scroll-x
                >
                  {(Object.keys(MODES) as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      data-testid={`desk-mode-${m}`}
                      className={cn(
                        "h-8 shrink-0 rounded-full px-3 text-xs touch:h-11",
                        mode === m ? "bg-home text-paper" : "bg-paper text-home",
                      )}
                    >
                      {MODES[m].tab}
                    </button>
                  ))}
                </div>
                <div className="rounded-card bg-white p-3 shadow-sm">
                  <label className="sr-only" htmlFor="desk-input">
                    {MODES[mode].label}
                  </label>
                  <textarea
                    id="desk-input"
                    ref={input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends a short question; a piece of writing keeps Enter for a new line.
                      if (e.key === "Enter" && !e.shiftKey && mode !== "write") {
                        e.preventDefault();
                        void send(mode);
                      }
                    }}
                    maxLength={MODES[mode].max}
                    rows={mode === "write" ? 6 : 2}
                    placeholder={MODES[mode].placeholder}
                    className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-mute"
                    data-testid="desk-input"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-paper px-3 py-1.5 text-xs text-mute">
                      {MODES[mode].label}
                    </span>
                    {threadId && (
                      <Button
                        variant="link"
                        onClick={() => void send("clarify")}
                        disabled={busy || !wallet.live || text.trim().length === 0}
                        data-testid="desk-clarify"
                      >
                        {CLARIFY}
                      </Button>
                    )}
                    <span className="ml-auto" />
                    <Dictate
                      onText={(t) =>
                        setText((old) => (old ? `${old} ${t}` : t).slice(0, MODES[mode].max))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => void send(mode)}
                      disabled={busy || !wallet.live || text.trim().length === 0}
                      className="flex h-9 items-center gap-2 rounded-full bg-home px-4 text-xs text-paper disabled:opacity-40 touch:h-11"
                      data-testid="desk-ask"
                    >
                      {busy ? ASKING : MODES[mode].button}
                      <Send className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                {MODES[mode].note && <p className="text-xs text-mute">{MODES[mode].note}</p>}
                <p className="text-xs text-mute">{MODEL_NOTE}</p>
              </div>
            </div>
            {showCanvas && lastDrawing && lastDrawing.answer !== null && (
              <div
                className="relative flex min-h-0 flex-col border-t border-home/5 bg-paper lg:border-l lg:border-t-0"
                data-testid="desk-canvas"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
                    <ImageIcon className="size-3.5" aria-hidden /> Canvas
                  </p>
                  <button
                    type="button"
                    onClick={() => setCanvasOn(false)}
                    className="grid size-11 place-items-center rounded-full bg-white"
                    aria-label="Close canvas"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <img
                  src={svgUrl(lastDrawing.answer)}
                  alt={DRAW_ALT}
                  className="mx-4 max-h-[min(52vh,420px)] rounded-control bg-white object-contain"
                />
                <p className="p-4 text-sm text-home/80">{lastDrawing.question}</p>
              </div>
            )}
          </section>

          <aside className="flex min-h-0 flex-col rounded-panel border border-white/80 bg-white/70 p-4 backdrop-blur-xl">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-sm font-medium">{COINS_LABEL}</h2>
                <p className="text-[11px] text-mute touch:text-xs">this month</p>
              </div>
              <p
                className="font-display text-3xl leading-none tabular-nums"
                data-testid="desk-coins"
              >
                {wallet.balance}
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-lilac to-gold"
                style={{ width: `${left}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-mute touch:text-xs">{COIN_NOTE}</p>
            <label className="mt-4 flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm text-mute has-[:focus-visible]:focus-ring touch:h-11">
              <Search className="size-3.5" aria-hidden />
              <input
                data-in-field
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your talks…"
                aria-label="Search your talks"
                className="min-w-0 flex-1 bg-transparent text-home outline-none"
              />
            </label>
            <h2 className="sr-only">{TALKS_TITLE}</h2>
            {threads.length === 0 ? (
              <p className="mt-3 text-xs text-mute" data-testid="desk-no-talks">
                {NO_TALKS}
              </p>
            ) : (
              <ul
                className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
                data-testid="desk-talks"
              >
                {shownTalks.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setThreadId(t.id);
                        setCanvasOn(true);
                      }}
                      className={cn(
                        "tap min-w-0 flex-1 rounded-control px-3 py-2.5 text-left",
                        t.id === threadId ? "bg-white shadow-sm" : "hover:bg-white/60",
                      )}
                    >
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-mute touch:text-xs">
                        {new Date(t.lastAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <Button
                      variant="link"
                      aria-label={DELETE_TALK}
                      onClick={() => void remove(t.id)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setThreadId(null);
                setCanvasOn(false);
                setText("");
              }}
              className="mt-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-home text-sm text-paper"
              data-testid="desk-new"
            >
              <Plus className="size-4" aria-hidden /> {NEW_TALK}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

// The five ways in, as the house mockup's cards. A topic card is filled with the topic the house's own rule picks, and the model answers it.
const STARTERS: { kind: Mode; title: string; body: string }[] = [
  {
    kind: "draw",
    title: "Draw this",
    body: "Turn a line of the chapter into a picture you can keep.",
  },
  {
    kind: "story",
    title: "Make it a story",
    body: "Tell the concept as a sitting under the tree.",
  },
  { kind: "paper", title: "Mock me", body: "Kind practice questions. No scare. Just the sitting." },
  {
    kind: "write",
    title: "Help me write",
    body: "A quiet page. You write. DHI sits with the gaps.",
  },
  { kind: "chat", title: "Hard question", body: "Ask what you could not untangle in class." },
];

// The topic the starters offer, by a fixed order: a topic due for recall, then one with a wrong answer still open, then the newest of the class.
function suggestTopic<T extends { due: boolean; openFix: number }>(topics: readonly T[]): T | null {
  return topics.find((t) => t.due) ?? topics.find((t) => t.openFix > 0) ?? topics[0] ?? null;
}

type Recognizer = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => Recognizer;
  webkitSpeechRecognition?: new () => Recognizer;
};

// Speaking a question instead of typing it, with the browser's own speech to text. Nothing reaches DHI until the student presses ask. The button
// shows only where the browser has it.
function Dictate({ onText }: { onText: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  const speech =
    typeof window === "undefined"
      ? undefined
      : ((window as unknown as SpeechWindow).SpeechRecognition ??
        (window as unknown as SpeechWindow).webkitSpeechRecognition);
  useEffect(() => () => rec.current?.stop(), []);
  if (!speech) return null;
  const Recognition = speech;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Stop speaking" : "Speak your question"}
      onClick={() => {
        if (on) {
          rec.current?.stop();
          return;
        }
        const r = new Recognition();
        r.lang = "en-IN";
        r.interimResults = false;
        r.onresult = (e) =>
          onText(
            Array.from(e.results)
              .map((x) => x[0]?.transcript ?? "")
              .join(" ")
              .trim(),
          );
        r.onend = () => setOn(false);
        rec.current = r;
        setOn(true);
        r.start();
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full touch:size-11",
        on ? "bg-danger text-paper" : "text-mute hover:bg-paper",
      )}
    >
      {on ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
    </button>
  );
}
