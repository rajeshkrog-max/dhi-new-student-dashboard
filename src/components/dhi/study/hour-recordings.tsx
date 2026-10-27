// One study hour's recordings for one institute (house spec 0027): asked from Stream when opened (`hourCall.recordings`), played in the page. A staff
// look is written for every student seated in that hour, so this loads only on the person's press.
import { useState } from "react";
import { useAction } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { HOUR_CALL_WORDS, hourCallRefusal } from "@/lib/dhi/hour-call-words";

type Item = { filename: string; url: string; startedAt: number; endedAt: number };

export function HourRecordings({ hourId, instituteId }: { hourId: GenericId<"studyHours">; instituteId: GenericId<"institutes"> }) {
  const recordings = useAction(api.hourCall.recordings);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await recordings({ hourId, instituteId });
      if (r.ok) setItems(r.items);
      else setError(hourCallRefusal(r.code));
    } catch {
      setError(HOUR_CALL_WORDS.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="hour-recordings">
      {items === null ? (
        <Button variant="quiet" disabled={busy} onClick={load}>
          {HOUR_CALL_WORDS.recordings}
        </Button>
      ) : items.length === 0 ? (
        <p className="text-xs text-mute">{HOUR_CALL_WORDS.noRecordings}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.filename}>
              <video src={it.url} controls preload="metadata" className="w-full max-w-xl rounded-control bg-ink/90" aria-label={`${HOUR_CALL_WORDS.recordings}: ${it.filename}`} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="px-3 py-2 text-xs">
          {error}
        </Notice>
      )}
    </div>
  );
}
