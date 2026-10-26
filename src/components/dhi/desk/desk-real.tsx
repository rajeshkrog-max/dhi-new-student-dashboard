// The DHI desk (spec house/0016). A signed in student asks a study question, spends a coin from their wallet, and keeps the talk. The server holds
// the wallet, the talks and the answers: this screen reads them with `desk.wallet`, `desk.threads` and `desk.thread` and asks through `deskAsk.ask`.
// A repeated question is answered from the stored answer for nothing, and a message that sounds like distress gets the care words and is stored nowhere.
// Answers are shown as plain text, never as markup.
import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { QUESTION_MAX, WRITE_MAX } from "@dhi/backend/deskRules";
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
} from "@/lib/dhi/desk-words";
import { DeskFeelingCard } from "@/components/dhi/desk/desk-feeling-card";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { cn } from "@/lib/utils";

// The three ways to ask: what each one is called, its box and its button. `max` is the same limit the server holds.
const MODES = {
  chat: { tab: MODE_ASK, label: ASK_LABEL, placeholder: ASK_PLACEHOLDER, button: ASK, max: QUESTION_MAX, rows: 3, note: null as string | null },
  write: { tab: MODE_WRITE, label: WRITE_LABEL, placeholder: WRITE_PLACEHOLDER, button: WRITE_BUTTON, max: WRITE_MAX, rows: 8, note: WRITE_NOTE as string | null },
  paper: { tab: MODE_PAPER, label: PAPER_LABEL, placeholder: PAPER_PLACEHOLDER, button: PAPER_BUTTON, max: QUESTION_MAX, rows: 3, note: PAPER_NOTE as string | null },
  mock: { tab: MODE_MOCK, label: PAPER_LABEL, placeholder: PAPER_PLACEHOLDER, button: MOCK_BUTTON, max: QUESTION_MAX, rows: 3, note: MOCK_NOTE as string | null },
  story: { tab: MODE_STORY, label: STORY_LABEL, placeholder: PAPER_PLACEHOLDER, button: STORY_BUTTON, max: QUESTION_MAX, rows: 3, note: STORY_NOTE as string | null },
  draw: { tab: MODE_DRAW, label: DRAW_LABEL, placeholder: DRAW_PLACEHOLDER, button: DRAW_BUTTON, max: QUESTION_MAX, rows: 3, note: DRAW_NOTE as string | null },
};
type Mode = keyof typeof MODES;

// A diagram is shown through an image tag, which never runs a script, and only after the server has checked it.
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function DeskReal() {
  const wallet = useQuery(api.desk.wallet, {});
  const threads = useQuery(api.desk.threads, {});
  const openWallet = useMutation(api.desk.open);
  const removeThread = useMutation(api.desk.removeThread);
  const ask = useAction(api.deskAsk.ask);
  const [threadId, setThreadId] = useState<string | null>(null);
  const talk = useQuery(api.desk.thread, threadId ? { threadId } : "skip");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [care, setCare] = useState(false);

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

  if (wallet === undefined || threads === undefined) {
    return (
      <p className="text-sm text-mute" data-testid="desk-loading">
        {LOADING}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="desk-room">
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

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{COINS_LABEL}</h2>
            <p className="font-display text-2xl font-medium tabular-nums" data-testid="desk-coins">
              {wallet.balance}
            </p>
            <p className="mt-1 text-xs text-mute">{COIN_NOTE}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{TALKS_TITLE}</h2>
            <Button variant="link" onClick={() => setThreadId(null)} data-testid="desk-new">
              {NEW_TALK}
            </Button>
          </div>
          {threads.length === 0 ? (
            <p className="text-xs text-mute" data-testid="desk-no-talks">
              {NO_TALKS}
            </p>
          ) : (
            <ul className="space-y-1" data-testid="desk-talks">
              {threads.map((t) => (
                <li key={t.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setThreadId(t.id)}
                    className={cn(
                      "tap min-w-0 flex-1 truncate rounded-control px-3 py-2 text-left text-sm",
                      t.id === threadId ? "bg-home/10 font-medium" : "hover:bg-home/5",
                    )}
                  >
                    {t.title}
                  </button>
                  <Button variant="link" aria-label={DELETE_TALK} onClick={() => void remove(t.id)}>
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4">
          {talk && talk.turns.length > 0 ? (
            <ol className="space-y-4" data-testid="desk-turns">
              {talk.turns.map((x) => (
                <li key={x.id} className="space-y-2">
                  <p className="rounded-control bg-home/5 px-3 py-2 text-sm whitespace-pre-wrap">
                    {x.question}
                  </p>
                  {x.status === "answered" && x.answer !== null && x.kind === "draw" ? (
                    <img
                      src={svgUrl(x.answer)}
                      alt={DRAW_ALT}
                      className="w-full max-w-md rounded-control bg-white/80"
                      data-testid="desk-diagram"
                    />
                  ) : x.status === "answered" && x.answer !== null ? (
                    <p className="px-1 text-sm whitespace-pre-wrap" data-testid="desk-answer">
                      {x.answer}
                    </p>
                  ) : x.status === "pending" ? (
                    <p className="px-1 text-sm text-mute">{ASKING}</p>
                  ) : null}
                  {x.status === "answered" && (
                    <p className="px-1 text-xs text-mute">
                      {x.cached ? FROM_STORE : COINS_SPENT(x.coinsSpent)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-mute">{NO_TALKS}</p>
          )}

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

          <div className="flex flex-wrap gap-2" role="group" data-testid="desk-modes">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "solid" : "quiet"}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                data-testid={`desk-mode-${m}`}
              >
                {MODES[m].tab}
              </Button>
            ))}
          </div>
          <label className="block">
            <span className="mb-2 block text-xs text-ink/70">{MODES[mode].label}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MODES[mode].max}
              rows={MODES[mode].rows}
              placeholder={MODES[mode].placeholder}
              className="w-full rounded-control border border-white/80 bg-white/60 p-3 text-sm outline-none placeholder:opacity-70 focus-visible:focus-ring"
              data-testid="desk-input"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void send(mode)}
              disabled={busy || !wallet.live || text.trim().length === 0}
              data-testid="desk-ask"
            >
              {busy ? ASKING : MODES[mode].button}
            </Button>
            {threadId && (
              <Button
                variant="quiet"
                onClick={() => void send("clarify")}
                disabled={busy || !wallet.live || text.trim().length === 0}
                data-testid="desk-clarify"
              >
                {CLARIFY}
              </Button>
            )}
          </div>
          {MODES[mode].note && <p className="text-xs text-mute">{MODES[mode].note}</p>}
          <p className="text-xs text-mute">{MODEL_NOTE}</p>
        </Card>
      </div>
    </div>
  );
}
