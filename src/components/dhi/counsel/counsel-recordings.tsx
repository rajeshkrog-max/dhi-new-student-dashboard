// A session's recording and transcript (spec house/0024), for its counselor and the people they shared it with. The files stay on Stream; this asks
// the backend (`counselCall.media`) for Stream's signed links when opened, and plays the recording in the page.
import { useState } from "react";
import { useAction } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { COUNSEL_WORDS, counselRefusal } from "@/lib/dhi/counsel-words";

type Item = { kind: string; filename: string; url: string; startedAt: number; endedAt: number };

export function CounselRecordings({ bookingId }: { bookingId: GenericId<"counselBookings"> }) {
  const media = useAction(api.counselCall.media);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await media({ bookingId });
      if (r.ok) setItems(r.items);
      else setError(counselRefusal(r.code));
    } catch {
      setError(COUNSEL_WORDS.callFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="counsel-recordings">
      {items === null ? (
        <Button variant="quiet" disabled={busy} onClick={load}>
          {COUNSEL_WORDS.recordings}
        </Button>
      ) : items.length === 0 ? (
        <p className="text-xs text-mute">{COUNSEL_WORDS.noRecordings}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.filename} className="space-y-1">
              {it.kind === "recording" ? (
                <video src={it.url} controls preload="metadata" className="w-full max-w-xl rounded-control bg-ink/90" aria-label={`${COUNSEL_WORDS.recordings}: ${it.filename}`} />
              ) : (
                <a href={it.url} target="_blank" rel="noreferrer noopener" className="text-sm underline">
                  {it.filename}
                </a>
              )}
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
