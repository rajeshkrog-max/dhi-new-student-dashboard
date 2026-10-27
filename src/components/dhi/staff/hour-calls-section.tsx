// Study hour calls for staff (house spec 0027; the owner's answers of 2026-10-28): a teacher of an institute, or a DHI admin naming one, joins the open
// hour's call to moderate, and opens any recording of the last 30 days, sharing it with a student of that institute who asked. Opening a recording
// writes the look in the "Who has looked" of every student seated in that hour.
import { lazy, Suspense, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { HourRecordings } from "@/components/dhi/study/hour-recordings";
import { Label, Outcome, SelectInput, TextInput } from "@/components/dhi/staff/staff-parts";
import { HOUR_CALL_WORDS, HOUR_CALL_WORDS_APPROVED, hourCallRefusal } from "@/lib/dhi/hour-call-words";

const HourCall = lazy(() => import("@/components/dhi/study/hour-call"));
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type InstituteId = GenericId<"institutes">;

export function HourCallsSection({ role }: { role: string }) {
  const isDhi = role === "dhi_admin";
  const institutes = usePaginatedQuery(api.institutes.list, isDhi ? {} : "skip", { initialNumItems: 50 });
  const [instituteId, setInstituteId] = useState<InstituteId | "">("");
  const [now] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const open = useQuery(api.hourShares.openNow, { now });
  const ready = !isDhi || instituteId !== "";
  const scoped = isDhi && instituteId ? { instituteId } : {};
  const hours = useQuery(api.hourShares.recordedHours, ready ? { ...scoped, now } : "skip");
  const [inCall, setInCall] = useState(false);

  return (
    <div className="space-y-4" data-testid="hour-calls">
      {!HOUR_CALL_WORDS_APPROVED && <p className="text-xs text-mute">{HOUR_CALL_WORDS.draft}</p>}
      <Card className="space-y-3">
        <p className="text-sm text-mute">{HOUR_CALL_WORDS.staffIntro}</p>
        {isDhi && (
          <Label text={HOUR_CALL_WORDS.institute}>
            <SelectInput value={instituteId} onChange={(e) => setInstituteId(e.target.value as InstituteId)} data-testid="hour-calls-institute">
              <option value="">{HOUR_CALL_WORDS.chooseInstitute}</option>
              {institutes.results.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.name}
                </option>
              ))}
            </SelectInput>
          </Label>
        )}
        {open === null ? (
          <p className="text-sm text-mute" data-testid="hour-calls-closed">
            {HOUR_CALL_WORDS.noOpenHour}
          </p>
        ) : open && ready && !inCall ? (
          <Button onClick={() => setInCall(true)} data-testid="hour-calls-join">
            {HOUR_CALL_WORDS.joinModerate}
          </Button>
        ) : null}
        {inCall && (
          <Suspense fallback={<p className="text-sm text-mute">{HOUR_CALL_WORDS.loading}</p>}>
            <HourCall {...(isDhi && instituteId ? { instituteId } : {})} onDone={() => setInCall(false)} />
          </Suspense>
        )}
      </Card>

      {ready && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">{HOUR_CALL_WORDS.recordedTitle}</h2>
          {hours === undefined ? (
            <p className="text-sm text-mute">{HOUR_CALL_WORDS.loading}</p>
          ) : hours.length === 0 ? (
            <p className="text-sm text-mute">{HOUR_CALL_WORDS.noRecorded}</p>
          ) : (
            <ul className="space-y-3" data-testid="hour-calls-list">
              {hours.map((h) => (
                <RecordedHour key={h.hourId} hour={h} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

type Hour = { hourId: GenericId<"studyHours">; instituteId: InstituteId; opensAt: number; closesAt: number; seated: number; shares: { name: string; email: string }[] };

function RecordedHour({ hour: h }: { hour: Hour }) {
  const share = useMutation(api.hourShares.share);
  const unshare = useMutation(api.hourShares.unshare);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; code?: string }>, ok: string) {
    setError("");
    setDone("");
    try {
      const r = await fn();
      if (r.ok) setDone(ok);
      else setError(hourCallRefusal(r.code));
    } catch (e) {
      setError(hourCallRefusal(e));
    }
  }

  return (
    <li className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3" data-testid="hour-calls-hour">
      <p className="text-sm font-medium">
        {when(h.opensAt)} · {HOUR_CALL_WORDS.seated(h.seated)}
      </p>
      <HourRecordings hourId={h.hourId} instituteId={h.instituteId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 grow basis-60">
          <span className="mb-1 block text-xs text-ink/70">{HOUR_CALL_WORDS.shareLabel}</span>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="hour-calls-share-email" />
        </label>
        <Button variant="quiet" disabled={!email.trim()} onClick={() => run(() => share({ hourId: h.hourId, instituteId: h.instituteId, email }), HOUR_CALL_WORDS.share)} data-testid="hour-calls-share">
          {HOUR_CALL_WORDS.share}
        </Button>
        <Button variant="quiet" disabled={!email.trim()} onClick={() => run(() => unshare({ hourId: h.hourId, instituteId: h.instituteId, email }), HOUR_CALL_WORDS.unshare)} data-testid="hour-calls-unshare">
          {HOUR_CALL_WORDS.unshare}
        </Button>
      </div>
      {h.shares.length > 0 && (
        <p className="text-xs text-mute">
          {HOUR_CALL_WORDS.sharedWith}: {h.shares.map((s) => s.name).join(", ")}
        </p>
      )}
      <div className="empty:hidden">
        <Outcome error={error} done={done} />
      </div>
    </li>
  );
}
