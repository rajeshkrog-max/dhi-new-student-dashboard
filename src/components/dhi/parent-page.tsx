import { useCallback, useEffect, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { TopBar } from "@/components/dhi/ui/top-bar";
import { LAMP_COPY, LANG_NAME, LANGS, dayLabel, roomName, type Lang } from "@/lib/dhi/brain-words";
import { PARENT_COPY, PARENT_LAMP_ORDER, PARENT_WORDS_APPROVED } from "@/lib/dhi/parent-words";

// The weekly parent page (house spec 0022). A parent has no account: the address carries the student's private code after a `#`, which a browser never
// sends to a server, so it is not in any log. The page asks the server once for the week and shows only what comes back: days logged in each room over
// the last seven days, and the three growth marks. Every refusal reads the same, so a wrong or ended link tells a stranger nothing.
type Opened = FunctionReturnType<typeof api.parentReport.open>;
type State = { kind: "loading" } | { kind: "done"; result: Opened } | { kind: "failed" };

let client: ConvexHttpClient | null = null;
const http = (): ConvexHttpClient => (client ??= new ConvexHttpClient(import.meta.env.PUBLIC_CONVEX_URL as string));

const until = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function ParentPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [lang, setLang] = useState<Lang>("en");
  const c = PARENT_COPY[lang];

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const code = window.location.hash.replace(/^#/, "").trim().toLowerCase();
      setState({ kind: "done", result: await http().mutation(api.parentReport.open, { code }) });
    } catch {
      setState({ kind: "failed" });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const result = state.kind === "done" ? state.result : null;
  const refused = result && !result.ok ? result : null;
  const slow = refused?.code === "slow_down";
  return (
    <main className="min-h-dvh bg-page text-home" data-testid="parent-page">
      <TopBar />
      <div className="mx-auto w-full max-w-xl space-y-3 px-4 py-6">
        <div className="flex justify-end gap-2" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <Button key={l} variant={l === lang ? "solid" : "quiet"} aria-pressed={l === lang} onClick={() => setLang(l)}>
              {LANG_NAME[l]}
            </Button>
          ))}
        </div>

        {state.kind === "loading" && (
          <p className="rounded-control bg-white/60 px-4 py-6 text-center text-sm text-mute" role="status" data-testid="parent-loading">
            {c.loading}
          </p>
        )}

        {(state.kind === "failed" || refused) && (
          <Card className="p-8 text-center" data-testid="parent-gone">
            <h1 className="font-display text-2xl font-medium">{slow ? c.slowTitle : c.goneTitle}</h1>
            <p className="mt-2 text-sm text-mute touch:text-base">{slow ? c.slow : c.gone}</p>
            {(state.kind === "failed" || slow) && (
              <div className="mt-4 flex justify-center">
                <Button variant="quiet" onClick={() => void load()}>
                  {c.retry}
                </Button>
              </div>
            )}
          </Card>
        )}

        {result && result.ok && (
          <>
            <Card>
              <h1 className="font-display text-2xl font-medium" data-testid="parent-title">
                {c.title(result.firstName)}
              </h1>
              <p className="mt-2 text-sm text-mute touch:text-base">{c.intro(result.firstName)}</p>
              <p className="mt-2 text-xs text-mute touch:text-sm">{c.range(dayLabel(result.week.from), dayLabel(result.week.to))}</p>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold">{c.roomsTitle}</h2>
              <ul className="mt-3 space-y-1.5" data-testid="parent-rooms">
                {result.week.rooms.map((r) => (
                  <li key={r.room} className="flex justify-between rounded-control bg-white/80 px-3 py-2 text-sm">
                    <span>{roomName(r.room, lang)}</span>
                    <span className="text-mute">{c.roomDays(r.days)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold">{c.lampsTitle}</h2>
              <p className="mt-2 text-xs text-mute touch:text-sm">{c.lampsNote(result.firstName)}</p>
              {result.week.enough ? (
                <ul className="mt-3 space-y-2" data-testid="parent-lamps">
                  {PARENT_LAMP_ORDER.map((id) => {
                    const value = result.week.lamps.find((l) => l.lamp === id)?.value ?? null;
                    return (
                      <li key={id} className="rounded-control bg-white/80 px-3 py-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{LAMP_COPY[id][lang].name}</span>
                          <span className="text-mute">{value === null ? c.lampEmpty : c.lampValue(value)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-mute touch:text-sm">{LAMP_COPY[id][lang].meaning}</p>
                        {value !== null && (
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-control bg-home/10" aria-hidden>
                            <div className="h-full bg-grove" style={{ width: `${value}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 rounded-control bg-white/60 px-4 py-4 text-sm text-mute" data-testid="parent-not-enough">
                  {c.notEnough(result.firstName)}
                </p>
              )}
            </Card>

            <p className="px-1 text-xs text-mute touch:text-sm">{c.neverShown(result.firstName)}</p>
            <p className="px-1 text-xs text-mute touch:text-sm">{c.until(until(result.expiresAt))}</p>
            {!PARENT_WORDS_APPROVED && (
              <Notice className="px-4 py-3 text-xs" data-testid="parent-draft">
                {c.draft}
              </Notice>
            )}
          </>
        )}
      </div>
    </main>
  );
}
