// The student's counseling room (spec house/0024): their bookings (join the call from 10 minutes before, cancel before it starts, read the
// counselor's note after), the free times of the next two weeks with an optional note, and any recording a counselor shared with them. The call
// itself is loaded only when it is opened.
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { JOIN_LATE_MS, NOTE_MAX, callOpenAt } from "@dhi/backend/counselRules";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { CounselRecordings } from "@/components/dhi/counsel/counsel-recordings";
import { COUNSEL_WORDS, COUNSEL_WORDS_APPROVED, counselRefusal, shownStatus } from "@/lib/dhi/counsel-words";

const CounselCall = lazy(() => import("@/components/dhi/counsel/counsel-call"));

const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

// The screen's own clock, to the minute, so the queries and the call window move on by themselves.
function useMinute(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 30000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function CounselRoom() {
  const now = useMinute();
  const mine = useQuery(api.counsel.mine, {});
  const free = useQuery(api.counsel.freeSlots, { now });
  const shared = useQuery(api.counsel.sharedWithMe, {});
  const book = useMutation(api.counsel.book);
  const cancel = useMutation(api.counsel.cancel);
  const [picked, setPicked] = useState<GenericId<"counselSlots"> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [inCall, setInCall] = useState<GenericId<"counselBookings"> | null>(null);

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof free>>();
    for (const s of free ?? []) groups.set(dayOf(s.startsAt), [...(groups.get(dayOf(s.startsAt)) ?? []), s]);
    return [...groups.entries()];
  }, [free]);

  async function run(fn: () => Promise<{ ok: boolean; code?: string }>, ok: string) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const r = await fn();
      if (r.ok) setDone(ok);
      else setError(counselRefusal(r.code));
    } catch (e) {
      setError(counselRefusal(e));
    } finally {
      setBusy(false);
    }
  }

  if (inCall) {
    return (
      <Suspense fallback={<p className="text-sm text-mute">{COUNSEL_WORDS.callLoading}</p>}>
        <CounselCall bookingId={inCall} onDone={() => setInCall(null)} />
      </Suspense>
    );
  }
  if (mine === undefined || free === undefined) return <p className="text-sm text-mute" data-testid="counsel-loading">{COUNSEL_WORDS.callLoading}</p>;

  return (
    <div className="space-y-4" data-testid="counsel-room">
      {!COUNSEL_WORDS_APPROVED && <p className="text-xs text-mute">{COUNSEL_WORDS.draft}</p>}
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">{COUNSEL_WORDS.title}</h2>
        <p className="text-sm text-mute touch:text-base">{COUNSEL_WORDS.intro}</p>
        <p className="text-xs text-mute touch:text-sm">{COUNSEL_WORDS.recordedNotice}</p>
      </Card>

      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm" data-testid="counsel-error">
          {error}
        </Notice>
      )}
      {done && (
        <Notice role="status" className="px-4 py-3 text-sm" data-testid="counsel-done">
          {done}
        </Notice>
      )}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">{COUNSEL_WORDS.mineTitle}</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-mute">{COUNSEL_WORDS.noMine}</p>
        ) : (
          <ul className="space-y-3" data-testid="counsel-mine">
            {mine.map((b) => (
              <li key={b.bookingId} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3">
                <p className="text-sm font-medium">
                  {when(b.startsAt)} · {b.counselor} · {shownStatus(b.status, b.endsAt, now, JOIN_LATE_MS)}
                </p>
                {b.note && <p className="text-xs text-mute">{b.note}</p>}
                {b.summary && (
                  <div className="rounded-control bg-mint/40 p-2">
                    <p className="text-xs font-medium">{COUNSEL_WORDS.summaryTitle}</p>
                    <p className="text-sm whitespace-pre-line">{b.summary}</p>
                  </div>
                )}
                {b.status === "booked" && (
                  <div className="flex flex-wrap gap-2">
                    {callOpenAt(b.startsAt, b.endsAt, now) && (
                      <Button onClick={() => setInCall(b.bookingId)} data-testid="counsel-open-call">
                        {COUNSEL_WORDS.openCall}
                      </Button>
                    )}
                    {now < b.startsAt && (
                      <Button variant="quiet" disabled={busy} onClick={() => run(() => cancel({ bookingId: b.bookingId }), COUNSEL_WORDS.status.cancelled_by_student)} data-testid="counsel-cancel">
                        {COUNSEL_WORDS.cancel}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">{COUNSEL_WORDS.freeTitle}</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-mute" data-testid="counsel-no-free">{COUNSEL_WORDS.noFree}</p>
        ) : (
          <div className="space-y-3" data-testid="counsel-free">
            {byDay.map(([day, slots]) => (
              <div key={day} className="space-y-1">
                <p className="text-xs font-medium text-mute">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button key={s.slotId} variant={picked === s.slotId ? "solid" : "quiet"} aria-pressed={picked === s.slotId} onClick={() => setPicked(s.slotId)} data-testid="counsel-slot">
                      {new Date(s.startsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} · {s.counselor}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs text-ink/70">{COUNSEL_WORDS.noteLabel}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX}
                rows={3}
                placeholder={COUNSEL_WORDS.notePlaceholder}
                className="w-full rounded-control border border-white/80 bg-white/60 p-3 text-sm outline-none placeholder:opacity-70 focus-visible:focus-ring"
                data-testid="counsel-note"
              />
            </label>
            <Button
              disabled={busy || !picked}
              data-testid="counsel-book"
              onClick={() =>
                run(async () => {
                  const r = await book({ slotId: picked as GenericId<"counselSlots">, note });
                  if (r.ok) {
                    setPicked(null);
                    setNote("");
                  }
                  return r;
                }, COUNSEL_WORDS.booked)
              }
            >
              {COUNSEL_WORDS.book}
            </Button>
          </div>
        )}
      </Card>

      {shared && shared.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">{COUNSEL_WORDS.sharedTitle}</h2>
          {shared.map((s) => (
            <div key={s.bookingId} className="space-y-1">
              <p className="text-sm">
                {when(s.startsAt)} · {s.counselor}
              </p>
              <CounselRecordings bookingId={s.bookingId} />
            </div>
          ))}
        </Card>
      )}

      <p className="text-xs text-mute touch:text-sm">{COUNSEL_WORDS.helpline}</p>
    </div>
  );
}
