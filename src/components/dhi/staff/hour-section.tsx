// The study hour, for DHI (spec house/0015). A DHI admin sets the hour: an open time and a close time, from 5 minutes to 8 hours, and no two hours
// overlap. The same file holds the chat review a teacher uses for the students of their own classes, and a DHI admin uses for reported messages.
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, TextInput } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

const WORDS: Record<string, string> = {
  bad_window: "An hour must close in the future and last from 5 minutes to 8 hours.",
  overlap: "That time overlaps another study hour.",
};
const wordFor = (error: unknown): string => WORDS[codeOf(error) ?? ""] ?? refusalWords(codeOf(error));
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function HourSection() {
  const hours = useQuery(api.studyHour.hours, {});
  const set = useMutation(api.studyHour.set);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    try {
      await set({ opensAt: new Date(opens).getTime(), closesAt: new Date(closes).getTime() });
      setDone("The study hour is set.");
    } catch (err) {
      setError(wordFor(err));
    }
  }

  return (
    <div className="space-y-5" data-testid="hour-section">
      <Card>
        <h2 className="text-sm font-semibold">Set a study hour</h2>
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label text="Opens">
            <TextInput data-testid="hour-opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} required />
          </Label>
          <Label text="Closes">
            <TextInput data-testid="hour-closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} required />
          </Label>
          <div className="sm:col-span-2">
            <Button type="submit">Set the hour</Button>
          </div>
        </form>
        {error && (
          <Notice tone="danger" role="alert" className="mt-3 px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
        {done && (
          <Notice role="status" className="mt-3 px-4 py-3 text-sm">
            {done}
          </Notice>
        )}
      </Card>
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">Recent and upcoming hours</h2>
        {hours?.length === 0 && <p className="text-sm text-mute">No hours yet.</p>}
        {hours?.map((h) => (
          <p key={h.hourId} className="text-sm">
            {when(h.opensAt)} to {when(h.closesAt)}
          </p>
        ))}
      </Card>
      <HourReview />
    </div>
  );
}

// The messages a teacher (their own classes) or a DHI admin (reported ones) may review, each with a Hide button.
export function HourReview() {
  const rows = useQuery(api.studyHour.review, {});
  const hide = useMutation(api.studyHour.hideMessage);
  const [error, setError] = useState("");
  async function act(messageId: GenericId<"chatMessages">) {
    setError("");
    try {
      await hide({ messageId });
    } catch (err) {
      setError(wordFor(err));
    }
  }
  if (rows === undefined) return null;
  return (
    <Card className="space-y-3" data-testid="hour-review">
      <h2 className="text-sm font-semibold">Study hour chat</h2>
      {rows.length === 0 && <p className="text-sm text-mute">No messages to look at.</p>}
      {rows.map((m) => (
        <div key={m.messageId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={m.status === "hidden" ? "text-mute line-through" : ""}>
            {m.authorName}: {m.text}
            {m.reported ? " (reported)" : ""}
          </span>
          {m.status === "shown" && (
            <Button variant="quiet" onClick={() => act(m.messageId)}>
              Hide
            </Button>
          )}
        </div>
      ))}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
    </Card>
  );
}
