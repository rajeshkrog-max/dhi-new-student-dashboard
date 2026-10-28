// The Brain report, on the Progress page (spec house/0020, scope row 22). It shows the student's own days only: what DHI noticed (a few fixed chains that
// came together in the last 14 days, each with the days and what happened on each, and a way to say it does not feel true), the expression note, the
// support offer when it applies, the three growth lamps with their movement, and what was logged lately with a way into each room. Everything comes
// from the server as ids and counts (convex/brain.ts); the sentences are the fixed templates of brain-words.ts, in English or Hinglish, and are drafts
// until the owner approves them. Nothing here ranks or labels a student, compares two students, or tells a student what to do.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import type { LampId, Movement } from "@dhi/backend/brainCodes";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import {
  BRAIN_WORDS_APPROVED,
  CONNECTION_COPY,
  EXPRESSION_COPY,
  INPUT_COPY,
  ITEM_COPY,
  LAMP_COPY,
  LANGS,
  LANG_NAME,
  MOVE_COPY,
  PATTERN_COPY,
  SUPPORT_COPY,
  UI,
  connectionText,
  dayLabel,
  isEvidenceItem,
  isLang,
  patternText,
  roomName,
  type Lang,
} from "@/lib/dhi/brain-words";

const LANG_KEY = "dhi-brain-lang";
function savedLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage can be blocked in a preview frame; English is the default.
  }
  return "en";
}

const percent = (x: number | null, lang: Lang): string => (x === null ? UI[lang].notYet : `${Math.round(x * 100)}%`);

export function BrainReport({ onOpen }: { onOpen: (room: string) => void }) {
  const data = useQuery(api.brain.report, {});
  const hide = useMutation(api.brain.hide);
  const show = useMutation(api.brain.show);
  const [lang, setLang] = useState<Lang>(savedLang);
  const [error, setError] = useState("");
  const ui = UI[lang];

  function pick(next: Lang) {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // The choice then lasts only for this visit.
    }
  }
  async function change(run: () => Promise<{ ok: boolean }>) {
    setError("");
    try {
      const r = await run();
      if (!r.ok) setError(ui.failed);
    } catch {
      setError(ui.failed);
    }
  }

  return (
    <div className="space-y-4" data-testid="brain-report" data-lang={lang} lang={lang === "hi" ? "hi-Latn" : "en"}>
      {!BRAIN_WORDS_APPROVED && <Notice data-testid="brain-draft-words">{ui.draftWords}</Notice>}
      {data?.draft.sources && <Notice data-testid="brain-draft-sources">{ui.draftSources}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">{ui.intro}</p>
        <div role="group" aria-label={ui.language} className="flex items-center gap-1">
          {LANGS.map((l) => (
            <Button key={l} variant="quiet" aria-pressed={lang === l} data-testid={`lang-${l}`} className={lang === l ? "bg-white shadow-sm" : "opacity-70"} onClick={() => pick(l)}>
              {LANG_NAME[l]}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}

      {data === undefined ? (
        <p className="text-sm text-mute">{ui.loading}</p>
      ) : (
        <>
          {data.support && (
            <Card className="space-y-2 bg-peach/30" data-testid="brain-support" aria-labelledby="brain-support-title">
              <h2 id="brain-support-title" className="text-base font-semibold">
                {SUPPORT_COPY[lang].title}
              </h2>
              <p className="text-sm">{SUPPORT_COPY[lang].text(data.support.lowDays)}</p>
              <p className="text-xs text-mute">{SUPPORT_COPY[lang].note}</p>
            </Card>
          )}

          <Card className="space-y-3" data-testid="brain-noticed">
            <h2 className="text-base font-semibold">{ui.title}</h2>
            {data.loggedDays < data.needDays ? (
              <p className="text-sm" data-testid="brain-empty">
                {ui.empty(data.needDays, data.loggedDays)}
              </p>
            ) : data.patterns.length === 0 && !data.expression ? (
              <p className="text-sm text-mute" data-testid="brain-none">
                {ui.noPattern}
              </p>
            ) : null}

            {data.loggedDays >= data.needDays &&
              data.patterns.map((p) => {
                const words = patternText(p.id, lang, p.params);
                if (!words) return null;
                return (
                  <article key={p.id} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-4" data-testid="pattern" data-pattern={p.id}>
                    <p className="text-xs text-grove">{ui.kind[p.kind === "supporting" ? "supporting" : "dragging"]}</p>
                    <h3 className="text-sm font-semibold">{words.title}</h3>
                    <p className="text-sm">{words.text}</p>
                    <p className="text-xs text-mute">{words.note}</p>
                    <details data-testid="evidence">
                      <summary className="tap cursor-pointer text-xs text-grove">{ui.seeDays}</summary>
                      <ul className="mt-2 space-y-2">
                        {p.evidence.map((e) => (
                          <li key={e.day} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="evidence-day">
                            <span className="font-medium">{dayLabel(e.day)}</span>
                            {e.items.map((i) => (
                              <span key={i.item} className="inline-flex items-center gap-1">
                                {isEvidenceItem(i.item) ? ITEM_COPY[i.item][lang] : i.item}
                                <Button variant="link" onClick={() => onOpen(i.room)} aria-label={ui.open(roomName(i.room, lang))}>
                                  {roomName(i.room, lang)}
                                </Button>
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <Button variant="quiet" data-testid="hide-pattern" onClick={() => change(() => hide({ id: p.id }))}>
                      {ui.hide}
                    </Button>
                  </article>
                );
              })}

            {data.connections.length > 0 && (
              <div className="space-y-2" data-testid="brain-connections">
                <h3 className="text-sm font-semibold">{ui.connectionsTitle}</h3>
                <p className="text-xs text-mute">{ui.connectionsIntro}</p>
                {data.connections.map((c) => {
                  const words = connectionText(c.id, lang, { a: c.a, b: c.b, n: c.nA + c.nB, ...(c.subject ? { subject: c.subject } : {}) });
                  if (!words) return null;
                  return (
                    <article key={c.id} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-4" data-testid="connection" data-connection={c.id}>
                      <h4 className="text-sm font-semibold">{words.title}</h4>
                      <p className="text-sm">{words.text}</p>
                      <p className="text-xs text-mute">{words.note}</p>
                      <Button variant="quiet" data-testid="hide-connection" onClick={() => change(() => hide({ id: c.id }))}>
                        {ui.hide}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}

            {data.loggedDays >= data.needDays && data.expression && (
              <article className="space-y-2 rounded-control border border-home/15 bg-white/70 p-4" data-testid="expression">
                <h3 className="text-sm font-semibold">{EXPRESSION_COPY[lang].title}</h3>
                <p className="text-sm">{EXPRESSION_COPY[lang].text(data.expression.runDays.length, data.expression.postDay)}</p>
                <p className="text-xs text-mute">{EXPRESSION_COPY[lang].note}</p>
                <Button variant="quiet" data-testid="hide-expression" onClick={() => change(() => hide({ id: "expression" }))}>
                  {ui.hide}
                </Button>
              </article>
            )}

            {data.hidden.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-mute" data-testid="hidden-patterns">
                <span>{ui.hidden(data.hidden.length)}</span>
                {data.hidden.map((id) => (
                  <Button key={id} variant="link" data-testid={`show-${id}`} onClick={() => change(() => show({ id }))}>
                    {(id === "expression" ? EXPRESSION_COPY[lang].title : ((PATTERN_COPY as Record<string, Record<Lang, { title: string }> | undefined>)[id]?.[lang].title ?? (CONNECTION_COPY as Record<string, Record<Lang, { title: string }> | undefined>)[id]?.[lang].title ?? id)) + ": " + ui.show}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4" data-testid="brain-lamps">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{ui.lampsTitle}</h2>
              <span className="text-sm">
                {ui.score}: <span className="font-display text-2xl" data-testid="brain-score">{data.score === null ? ui.notYet : data.score}</span>
              </span>
            </div>
            <p className="text-xs text-mute">{ui.lampsIntro}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.lamps.map((l) => {
                const copy = LAMP_COPY[l.lamp as LampId]?.[lang];
                const move = MOVE_COPY[(l.movement ?? "none") as Movement | "none"][lang];
                return (
                  <div key={l.lamp} className="rounded-control border border-home/15 bg-white/70 p-3" data-testid={`brain-lamp-${l.lamp}`}>
                    <p className="text-sm font-medium">
                      {copy?.name ?? l.lamp} {l.value === null ? "" : `· ${percent(l.value, lang)}`}
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-home/10" aria-hidden>
                      <div className="h-2 rounded-full bg-mint" style={{ width: `${Math.round((l.value ?? 0) * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-mute">{copy?.meaning}</p>
                    <ul className="mt-2 space-y-1 text-xs text-mute">
                      {l.inputs.map((i) => (
                        <li key={i.metric}>
                          {INPUT_COPY[i.metric]?.[lang] ?? i.metric}: {percent(i.value, lang)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs" data-testid={`movement-${l.lamp}`}>
                      {move}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-3" data-testid="brain-log">
            <h2 className="text-base font-semibold">{ui.logTitle}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.coverage.map((c) => (
                <li key={c.room} className="flex items-center justify-between gap-2 rounded-control border border-home/15 bg-white/70 px-3 py-2 text-sm">
                  <span>
                    {roomName(c.room, lang)} <span className="text-xs text-mute">· {ui.logDays(c.days)}</span>
                  </span>
                  <Button variant="link" onClick={() => onOpen(c.room)} data-testid={`open-${c.room}`}>
                    {ui.open(roomName(c.room, lang))}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
