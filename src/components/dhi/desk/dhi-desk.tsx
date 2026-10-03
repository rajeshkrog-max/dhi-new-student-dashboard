/**
 * DHI desk — sittings, coins, split canvas, cached drawings.
 * UI: welcome + composer | history rail. Canvas opens beside chat.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Paperclip, Plus, Search, Send, Sparkles, X } from "lucide-react";
import {
  STARTERS,
  attachPdf,
  coinsLeft,
  loadDesk,
  newThread,
  pickMock,
  saveDraft,
  sit,
  thinkingLine,
  type DeskKind,
  type DeskStore,
  type DeskThread,
} from "@/lib/dhi/desk";
import { HOME } from "@/lib/dhi/home-demo";
import { cn } from "@/lib/utils";

export function DhiDesk() {
  const [store, setStore] = useState<DeskStore>(() => ({
    studentId: "",
    wallet: { studentId: "", allotment: 0, bonus: 0, spent: 0 },
    threads: [],
    cache: {},
  }));
  const [tid, setTid] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [think, setThink] = useState("");
  const [pending, setPending] = useState("");
  const [canvasOn, setCanvasOn] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadDesk();
    setStore(s);
    setTid(s.threads[0]?.id ?? null);
  }, []);

  const thread = store.threads.find((t) => t.id === tid) ?? store.threads[0];
  const left = coinsLeft(store.wallet);
  const used = store.wallet.allotment ? Math.min(100, (store.wallet.spent / store.wallet.allotment) * 100) : 0;
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? store.threads.filter((t) => (t.title + t.preview).toLowerCase().includes(n)) : store.threads;
  }, [store.threads, q]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length, busy, pending]);

  async function send(text: string, kind?: DeskKind) {
    const line = text.trim();
    if (!line || busy) return;
    let id = thread?.id;
    let s = store;
    if (!id) {
      s = newThread(s);
      id = s.threads[0].id;
      setStore(s);
      setTid(id);
    }
    setDraft("");
    setPending(line);
    setBusy(true);
    setThink(thinkingLine(kind));
    await wait(kind === "draw" || kind === "story" ? 1600 : 1100);
    const r = sit(s, id, line, kind);
    setStore(r.store);
    setTid(r.store.threads[0].id);
    setPending("");
    setBusy(false);
    setThink("");
    if (r.store.threads[0].canvas) setCanvasOn(true);
  }

  function startNew() {
    const s = newThread(store);
    setStore(s);
    setTid(s.threads[0].id);
    setCanvasOn(false);
  }

  const showCanvas = canvasOn && thread?.canvas;

  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_260px]">
      <section className={cn("grid min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/80 bg-white/65 shadow-sm backdrop-blur-xl", showCanvas && "lg:grid-cols-2")}>
        <div className="flex min-h-0 flex-col">
          <DeskChat
            thread={thread}
            pending={pending}
            busy={busy}
            think={think}
            onStarter={(s) => send(s.body, s.kind)}
            onPick={(mid, i, p) => thread && setStore(pickMock(store, thread.id, mid, i, p))}
            onDraft={(mid, d) => thread && setStore(saveDraft(store, thread.id, mid, d))}
            endRef={endRef}
          />
          <Composer
            value={draft}
            busy={busy}
            onChange={setDraft}
            onSend={() => send(draft)}
            onAttach={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f || !thread) return;
              setBusy(true);
              setThink("Reading the pages…");
              setTimeout(() => {
                const r = attachPdf(store, thread.id, f.name);
                setStore(r.store);
                setBusy(false);
                setThink("");
              }, 1200);
            }}
          />
        </div>
        {showCanvas && thread?.canvas && (
          <CanvasPane src={thread.canvas.src} caption={thread.canvas.caption} onClose={() => setCanvasOn(false)} />
        )}
      </section>

      <aside className="flex min-h-0 flex-col rounded-[28px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium">Sittings</p>
            <p className="text-[11px] text-mute">coins left</p>
          </div>
          <p className="font-display text-3xl leading-none">{left}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#efeae3]">
          <div className="h-full rounded-full bg-gradient-to-r from-lilac to-gold" style={{ width: `${Math.max(6, 100 - used)}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-mute">
          {store.wallet.spent} spent of {store.wallet.allotment}. Admin sets the bowl.
        </p>
        <label className="mt-4 flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm text-mute">
          <Search className="size-3.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sittings…" className="min-w-0 flex-1 bg-transparent text-home outline-none" />
        </label>
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setTid(t.id);
                  if (t.canvas) setCanvasOn(true);
                }}
                className={cn("w-full rounded-2xl px-3 py-2.5 text-left", t.id === thread?.id ? "bg-white shadow-sm" : "hover:bg-white/60")}
              >
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-mute">{t.preview}</p>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={startNew} className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-home text-sm text-paper">
          <Plus className="size-4" /> New sitting
        </button>
      </aside>
    </div>
  );
}

function DeskChat({
  thread,
  pending,
  busy,
  think,
  onStarter,
  onPick,
  onDraft,
  endRef,
}: {
  thread?: DeskThread;
  pending: string;
  busy: boolean;
  think: string;
  onStarter: (s: (typeof STARTERS)[number]) => void;
  onPick: (mid: string, i: number, p: number) => void;
  onDraft: (mid: string, d: string) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  const empty = !thread || (thread.messages.length === 0 && !pending);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="relative mb-4 grid size-16 place-items-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-lilac via-peach to-gold opacity-70 blur-md" />
            <span className="relative grid size-12 place-items-center rounded-full bg-white text-gold-ink shadow-sm">
              <Sparkles className="size-6" />
            </span>
          </div>
          <h2 className="font-display text-4xl">Welcome, {HOME.student.name.split(" ")[0]}</h2>
          <p className="mt-2 text-sm text-mute">How shall we sit today?</p>
          <div className="mt-8 grid w-full max-w-xl gap-3 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s.id} type="button" onClick={() => onStarter(s)} className="rounded-[22px] bg-white p-4 text-left shadow-sm hover:shadow">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs text-mute">{s.body}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {thread?.messages.map((m) => (
            <article key={m.id} className={cn("max-w-[92%] rounded-[22px] px-4 py-3 text-sm", m.role === "student" ? "ml-auto bg-home text-paper" : "bg-white text-home shadow-sm")}>
              {m.role === "dhi" && (
                <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-mute">
                  <Sparkles className="size-3" /> DHI
                  {m.cacheHit && <span className="ml-1 rounded-full bg-mint/60 px-1.5 normal-case tracking-normal">saved</span>}
                  {m.coins > 0 && <span className="ml-1 normal-case tracking-normal">· {m.coins} coins</span>}
                </p>
              )}
              <p className="leading-relaxed">{m.body}</p>
              {m.mock && (
                <ul className="mt-3 space-y-3">
                  {m.mock.map((q, i) => (
                    <li key={i} className="rounded-2xl bg-paper/80 p-3">
                      <p className="font-medium">{q.q}</p>
                      <div className="mt-2 grid gap-1.5">
                        {q.options.map((o, j) => {
                          const picked = q.pick === j;
                          const reveal = q.pick != null;
                          const right = j === q.answer;
                          return (
                            <button
                              key={o}
                              type="button"
                              onClick={() => onPick(m.id, i, j)}
                              className={cn(
                                "rounded-xl px-3 py-2 text-left text-xs",
                                picked && right && "bg-mint",
                                picked && !right && "bg-peach/70",
                                !picked && reveal && right && "bg-mint/50",
                                !picked && !reveal && "bg-white",
                              )}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {m.writing && (
                <textarea
                  value={m.writing.draft}
                  onChange={(e) => onDraft(m.id, e.target.value)}
                  placeholder="Write here…"
                  rows={6}
                  className="mt-3 w-full resize-none rounded-2xl bg-paper/90 p-3 text-sm leading-7 text-home outline-none"
                />
              )}
            </article>
          ))}
          {pending && <article className="ml-auto max-w-[92%] rounded-[22px] bg-home px-4 py-3 text-sm text-paper">{pending}</article>}
          {busy && (
            <article className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 text-sm shadow-sm">
              <span className="dhi-sit text-gold-ink">
                <span>●</span>
                <span className="mx-0.5">●</span>
                <span>●</span>
              </span>
              <span className="text-mute">{think}</span>
            </article>
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

function Composer({
  value,
  busy,
  onChange,
  onSend,
  onAttach,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
}) {
  return (
    <div className="border-t border-home/5 p-4">
      <div className="rounded-[24px] bg-white p-3 shadow-sm">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder="Ask DHI — a picture, a story, a mock, a page…"
          className="w-full resize-none bg-transparent text-sm outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={onAttach} className="rounded-full bg-paper px-3 py-1.5 text-xs">
            <Paperclip className="mr-1 inline size-3.5" /> Attach
          </button>
          <span className="rounded-full bg-paper px-3 py-1.5 text-xs text-mute">PDF · image</span>
          <span className="ml-auto grid size-8 place-items-center rounded-full text-mute">
            <Mic className="size-4" />
          </span>
          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={onSend}
            className="grid size-9 place-items-center rounded-full bg-home text-paper disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasPane({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  return (
    <div className="relative flex min-h-0 flex-col border-t border-home/5 bg-[#f7f3ee] lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-mute">
          <ImageIcon className="size-3.5" /> Canvas
        </p>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white" aria-label="Close canvas">
          <X className="size-4" />
        </button>
      </div>
      <img src={src} alt="" className="mx-4 max-h-[min(52vh,420px)] rounded-2xl object-contain" />
      <p className="p-4 text-sm text-home/80">{caption}</p>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
