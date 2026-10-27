// The counselor's sessions (spec house/0024): open 30 minute times of their own, see each booking (first name, class, school and the student's
// note only), join the call from 10 minutes before, cancel before it starts, mark it done with a short note, and open the recording, sharing it with
// a person of the house who asked. The call is loaded only when it is opened.
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { JOIN_LATE_MS, SUMMARY_MAX, callOpenAt } from "@dhi/backend/counselRules";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { CounselRecordings } from "@/components/dhi/counsel/counsel-recordings";
import { Outcome } from "@/components/dhi/staff/staff-parts";
import { COUNSEL_WORDS, COUNSEL_WORDS_APPROVED, counselRefusal, shownStatus } from "@/lib/dhi/counsel-words";

const CounselCall = lazy(() => import("@/components/dhi/counsel/counsel-call"));

type BookingId = GenericId<"counselBookings">;
type Reply = { ok: boolean; code?: string };

const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const todayIndia = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function useMinute(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 30000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function CounselSection() {
  const now = useMinute();
  const slots = useQuery(api.counsel.mySlots, { now });
  const openSlot = useMutation(api.counsel.openSlot);
  const closeSlot = useMutation(api.counsel.closeSlot);
  const cancel = useMutation(api.counsel.cancelByCounselor);
  const [date, setDate] = useState(todayIndia);
  const [time, setTime] = useState("16:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [inCall, setInCall] = useState<BookingId | null>(null);

  async function run(fn: () => Promise<Reply>, ok: string) {
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

  return (
    <div className="space-y-4" data-testid="counsel-staff">
      {!COUNSEL_WORDS_APPROVED && <p className="text-xs text-mute">{COUNSEL_WORDS.draft}</p>}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">{COUNSEL_WORDS.openSlotLabel}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink/70">Day</span>
            <input type="date" value={date} min={todayIndia()} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-control border border-white/80 bg-white/60 px-3 text-sm focus-visible:focus-ring" data-testid="counsel-slot-date" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink/70">Time (India)</span>
            <select value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-control border border-white/80 bg-white/60 px-3 text-sm focus-visible:focus-ring" data-testid="counsel-slot-time">
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !date}
            data-testid="counsel-open-slot"
            onClick={() => run(() => openSlot({ startsAt: Date.parse(`${date}T${time}:00+05:30`) }), `${COUNSEL_WORDS.openSlot}: ${date} ${time}`)}
          >
            {COUNSEL_WORDS.openSlot}
          </Button>
        </div>
        <div className="empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">{COUNSEL_WORDS.slotsTitle}</h2>
        {slots === undefined ? (
          <p className="text-sm text-mute">{COUNSEL_WORDS.callLoading}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-mute">{COUNSEL_WORDS.noSlots}</p>
        ) : (
          <ul className="space-y-3" data-testid="counsel-slots">
            {slots.map((s) => (
              <li key={s.slotId} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3">
                <p className="text-sm font-medium">
                  {when(s.startsAt)} · {s.booking ? shownStatus(s.booking.status, s.endsAt, now, JOIN_LATE_MS) : "Free"}
                </p>
                {!s.booking ? (
                  s.status === "open" && (
                    <Button variant="quiet" disabled={busy} onClick={() => run(() => closeSlot({ slotId: s.slotId }), COUNSEL_WORDS.closeSlot)}>
                      {COUNSEL_WORDS.closeSlot}
                    </Button>
                  )
                ) : (
                  <BookingCard
                    booking={s.booking}
                    startsAt={s.startsAt}
                    endsAt={s.endsAt}
                    now={now}
                    busy={busy}
                    onJoin={() => setInCall(s.booking!.bookingId)}
                    onCancel={() => run(() => cancel({ bookingId: s.booking!.bookingId }), COUNSEL_WORDS.status.cancelled_by_counselor)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type Booking = { bookingId: BookingId; status: string; firstName: string; className: string; school: string; note: string; summary: string; shares: number };

function BookingCard({ booking: b, startsAt, endsAt, now, busy, onJoin, onCancel }: { booking: Booking; startsAt: number; endsAt: number; now: number; busy: boolean; onJoin: () => void; onCancel: () => void }) {
  const finish = useMutation(api.counsel.finish);
  const share = useMutation(api.counsel.shareRecording);
  const unshare = useMutation(api.counsel.unshareRecording);
  const [summary, setSummary] = useState(b.summary);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(fn: () => Promise<Reply>, ok: string) {
    setWorking(true);
    setError("");
    setDone("");
    try {
      const r = await fn();
      if (r.ok) setDone(ok);
      else setError(counselRefusal(r.code));
    } catch (e) {
      setError(counselRefusal(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="counsel-booking">
      <p className="text-sm">
        {b.firstName} · {b.className} · {b.school}
      </p>
      {b.note && <p className="rounded-control bg-white/60 p-2 text-sm whitespace-pre-line">{b.note}</p>}
      <div className="flex flex-wrap gap-2">
        {b.status === "booked" && callOpenAt(startsAt, endsAt, now) && (
          <Button onClick={onJoin} data-testid="counsel-open-call">
            {COUNSEL_WORDS.openCall}
          </Button>
        )}
        {b.status === "booked" && now < startsAt && (
          <Button variant="quiet" disabled={busy} onClick={onCancel}>
            {COUNSEL_WORDS.cancel}
          </Button>
        )}
      </div>
      {now >= startsAt && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink/70">{COUNSEL_WORDS.summaryLabel}</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={SUMMARY_MAX}
              rows={3}
              className="w-full rounded-control border border-white/80 bg-white/60 p-3 text-sm outline-none focus-visible:focus-ring"
              data-testid="counsel-summary"
            />
          </label>
          <Button variant="quiet" disabled={working} onClick={() => run(() => finish({ bookingId: b.bookingId, summary }), COUNSEL_WORDS.status.done)} data-testid="counsel-finish">
            {COUNSEL_WORDS.finish}
          </Button>
          <CounselRecordings bookingId={b.bookingId} />
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-0 grow basis-60">
              <span className="mb-1 block text-xs text-ink/70">{COUNSEL_WORDS.shareLabel}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-control border border-white/80 bg-white/60 px-3 text-sm focus-visible:focus-ring"
                data-testid="counsel-share-email"
              />
            </label>
            <Button variant="quiet" disabled={working || !email.trim()} onClick={() => run(() => share({ bookingId: b.bookingId, email }), COUNSEL_WORDS.share)} data-testid="counsel-share">
              {COUNSEL_WORDS.share}
            </Button>
            <Button variant="quiet" disabled={working || !email.trim()} onClick={() => run(() => unshare({ bookingId: b.bookingId, email }), COUNSEL_WORDS.unshare)} data-testid="counsel-unshare">
              {COUNSEL_WORDS.unshare}
            </Button>
          </div>
          {b.shares > 0 && <p className="text-xs text-mute">{COUNSEL_WORDS.sharedWith(b.shares)}</p>}
        </div>
      )}
      <div className="empty:hidden">
        <Outcome error={error} done={done} />
      </div>
    </div>
  );
}

// Recordings a counselor shared with this staff member, if any (any staff role). Shown under Your data.
export function SharedRecordings() {
  const shared = useQuery(api.counsel.sharedWithMe, {});
  if (!shared || shared.length === 0) return null;
  return (
    <Card className="space-y-3" data-testid="counsel-shared">
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
  );
}
