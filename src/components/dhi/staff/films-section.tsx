// The films, for a DHI admin (spec house/0013). A DHI admin uploads a film with its category, score and length, and an academic film carries two
// check questions. A film stays hidden from students until it is approved here. The video reference is a file in the house's own public folder
// for now (the stand in host); a hosted video id is accepted too, and plays once the video host is set up.
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, SelectInput, TextInput } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

const CATEGORIES = [
  { value: "academic", label: "Academic" },
  { value: "self_help", label: "Self help" },
  { value: "mental_health", label: "Mental health" },
];

type CheckDraft = { question: string; options: string; rightOption: number };
const blankCheck = (): CheckDraft => ({ question: "", options: "", rightOption: 1 });

const FILM_WORDS: Record<string, string> = {
  bad_title: "Please write a title, up to 80 characters.",
  bad_category: "Please pick a category.",
  bad_blurb: "Please write a short line about the film, up to 200 characters.",
  bad_score: "The score must be a whole number from 1 to 100.",
  bad_duration: "The length must be from 10 seconds to 2 hours.",
  bad_host_ref: "The video reference must be a file path in the house's folder, like /landing/day.mp4, or a hosted video id.",
  bad_cover: "The cover must be an image path in the house's folder, like /mood/thought.jpg.",
  bad_check: "An academic film needs exactly two check questions, each with 2 to 4 options and one right option. Other films have none.",
};
const wordFor = (error: unknown): string => FILM_WORDS[codeOf(error) ?? ""] ?? refusalWords(codeOf(error));

export function FilmsSection() {
  const pending = useQuery(api.films.pending, {});
  const upload = useMutation(api.films.upload);
  const approve = useMutation(api.films.approve);
  const [f, setF] = useState({ title: "", category: "self_help", blurb: "", cover: "/mood/thought.jpg", hostRef: "/landing/day.mp4", durationSec: 15, scoreValue: 10 });
  const [checks, setChecks] = useState<CheckDraft[]>([blankCheck(), blankCheck()]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const academic = f.category === "academic";

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    const sent = academic
      ? checks.map((c) => ({ question: c.question, options: c.options.split("\n").map((o) => o.trim()).filter((o) => o.length > 0), rightOption: c.rightOption - 1 }))
      : [];
    try {
      await upload({ ...f, checks: sent });
      setDone("The film is saved and waiting for approval.");
      setF({ ...f, title: "", blurb: "" });
      setChecks([blankCheck(), blankCheck()]);
    } catch (err) {
      setError(wordFor(err));
    }
  }

  async function approveFilm(filmId: GenericId<"films">, title: string) {
    setError("");
    setDone("");
    try {
      await approve({ filmId });
      setDone(`${title} is approved. Students can see it now.`);
    } catch (err) {
      setError(wordFor(err));
    }
  }

  return (
    <div className="space-y-5" data-testid="films-section">
      <Card>
        <h2 className="text-sm font-semibold">Upload a film</h2>
        <form onSubmit={send} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label text="Title">
            <TextInput data-testid="film-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={80} />
          </Label>
          <Label text="Category">
            <SelectInput data-testid="film-category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text="A short line about the film" className="sm:col-span-2">
            <TextInput data-testid="film-blurb" value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} required maxLength={200} />
          </Label>
          <Label text="Cover image (a path in the house's folder)">
            <TextInput value={f.cover} onChange={(e) => setF({ ...f, cover: e.target.value })} required />
          </Label>
          <Label text="Video reference (a path like /landing/day.mp4, or a hosted video id)">
            <TextInput data-testid="film-host" value={f.hostRef} onChange={(e) => setF({ ...f, hostRef: e.target.value })} required />
          </Label>
          <Label text="Length in seconds">
            <TextInput type="number" min={10} max={7200} value={f.durationSec} onChange={(e) => setF({ ...f, durationSec: Number(e.target.value) })} required />
          </Label>
          <Label text="Score when kept (1 to 100)">
            <TextInput type="number" min={1} max={100} value={f.scoreValue} onChange={(e) => setF({ ...f, scoreValue: Number(e.target.value) })} required />
          </Label>
          {academic &&
            checks.map((c, i) => (
              <div key={i} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3 sm:col-span-2">
                <p className="text-xs text-mute">Check question {i + 1}</p>
                <Label text="Question">
                  <TextInput value={c.question} onChange={(e) => setChecks((list) => list.map((x, n) => (n === i ? { ...x, question: e.target.value } : x)))} maxLength={200} />
                </Label>
                <Label text="Options, one a line (2 to 4)">
                  <textarea
                    className="w-full rounded-control border border-home/15 bg-white/80 p-3 text-sm"
                    rows={3}
                    value={c.options}
                    onChange={(e) => setChecks((list) => list.map((x, n) => (n === i ? { ...x, options: e.target.value } : x)))}
                  />
                </Label>
                <Label text="Right option (its number, starting at 1)">
                  <TextInput type="number" min={1} max={4} value={c.rightOption} onChange={(e) => setChecks((list) => list.map((x, n) => (n === i ? { ...x, rightOption: Number(e.target.value) } : x)))} />
                </Label>
              </div>
            ))}
          <div className="sm:col-span-2">
            <Button type="submit" data-testid="film-upload">
              Save film
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3" data-testid="films-pending">
        <h2 className="text-sm font-semibold">Waiting for approval</h2>
        {pending === undefined && <p className="text-sm text-mute">Loading…</p>}
        {pending?.length === 0 && <p className="text-sm text-mute">No films are waiting.</p>}
        {pending?.map((p) => (
          <div key={p.filmId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {p.title} · {CATEGORIES.find((c) => c.value === p.category)?.label} · {p.checks} check question{p.checks === 1 ? "" : "s"}
            </span>
            <Button variant="quiet" onClick={() => approveFilm(p.filmId, p.title)} aria-label={`Approve ${p.title}`}>
              Approve
            </Button>
          </div>
        ))}
      </Card>

      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      {done && (
        <Notice role="status" className="px-4 py-3 text-sm">
          {done}
        </Notice>
      )}
    </div>
  );
}
