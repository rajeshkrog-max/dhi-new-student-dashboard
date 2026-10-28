// Papers and review, for teachers (spec house/0011 and house/0014). A teacher builds a paper with multiple choice and long questions, sends it to
// one of their classes with an open and a due time, and marks each long answer by hand with remarks before confirming it. The same section
// holds the posts and comments of their classes that are waiting for review. Answers and right options never reach a student from here.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, SelectInput, TextInput, useScope } from "@/components/dhi/staff/staff-parts";
import { HourReview } from "@/components/dhi/staff/hour-section";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";
import { SUBJECTS } from "@dhi/backend/sessionRules";
import { SUBJECT_WORDS } from "@/lib/dhi/desk-words";

type Draft =
  | { kind: "mcq"; subject: string; topic: string; text: string; options: string; rightOption: number; tags: string[]; hint: string }
  | { kind: "long"; subject: string; topic: string; text: string; maxMarks: number; rubric: string; hint: string };

const blankMcq = (): Draft => ({ kind: "mcq", subject: "", topic: "", text: "", options: "", rightOption: 1, tags: [], hint: "" });
const blankLong = (): Draft => ({ kind: "long", subject: "", topic: "", text: "", maxMarks: 10, rubric: "", hint: "" });

// Builds the question as the server expects it. Options are one a line; a wrong option's tag is "" (none), "misread" or "concept".
function toInput(d: Draft) {
  const hint = d.hint.trim() ? { hint: d.hint.trim() } : {};
  if (d.kind === "long") return { kind: "long" as const, subject: d.subject, topic: d.topic, text: d.text, maxMarks: d.maxMarks, rubric: d.rubric, ...hint };
  const options = d.options.split("\n").map((o) => o.trim()).filter((o) => o.length > 0);
  const rightIndex = d.rightOption - 1;
  const tags = options.map((_, i) => (i === rightIndex ? null : ((d.tags[i] || null) as "misread" | "concept" | null)));
  return { kind: "mcq" as const, subject: d.subject, topic: d.topic, text: d.text, options, rightOption: rightIndex, tags, ...hint };
}

export function PapersSection() {
  const scope = useScope();
  const mine = useQuery(api.papers.mineAsTeacher, {});
  const classes = usePaginatedQuery(api.classes.list, scope.needsInstitute ? "skip" : { instituteId: scope.instituteId }, { initialNumItems: 50 });
  const create = useMutation(api.papers.create);
  const send = useMutation(api.papers.send);
  const [title, setTitle] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([blankMcq()]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [paperId, setPaperId] = useState<GenericId<"papers"> | "">("");
  const [classId, setClassId] = useState<GenericId<"classes"> | "">("");
  const [opens, setOpens] = useState("");
  const [due, setDue] = useState("");

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((list) => list.map((d, n) => (n === i ? ({ ...d, ...patch } as Draft) : d)));
  }

  async function build(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      const id = await create({ title, questions: drafts.map(toInput) as never });
      setDone("The paper is saved. Send it to a class when you are ready.");
      setPaperId(id);
      setTitle("");
      setDrafts([blankMcq()]);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
    setBusy(false);
  }

  async function sendPaper(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!paperId || !classId || !opens || !due) return setError("Pick a paper, a class, and both times.");
    try {
      const r = await send({
        paperId,
        target: { kind: "class", classId },
        opensAt: new Date(opens).getTime(),
        dueAt: new Date(due).getTime(),
      });
      setDone(`Sent to ${r.made} student${r.made === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="space-y-5" data-testid="papers-section">
      <Card>
        <h2 className="text-sm font-semibold">Build a paper</h2>
        <form onSubmit={build} className="mt-3 space-y-4">
          <Label text="Paper title">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </Label>
          {drafts.map((d, i) => (
            <div key={i} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3">
              <p className="text-xs text-mute">
                Question {i + 1}, {d.kind === "mcq" ? "multiple choice" : "long answer"}
              </p>
              {/* The subject is one of the fixed list (house spec 0028), so a student's desk or study hour card can name the same one. */}
              <Label text="Subject">
                <SelectInput value={d.subject} onChange={(e) => update(i, { subject: e.target.value })} required data-testid="question-subject">
                  <option value="">Pick a subject</option>
                  {SUBJECTS.map((code) => (
                    <option key={code} value={code}>
                      {SUBJECT_WORDS[code]}
                    </option>
                  ))}
                </SelectInput>
              </Label>
              <Label text="Topic">
                <TextInput value={d.topic} onChange={(e) => update(i, { topic: e.target.value })} required maxLength={60} />
              </Label>
              <Label text="Question">
                <TextInput value={d.text} onChange={(e) => update(i, { text: e.target.value })} required maxLength={500} />
              </Label>
              {d.kind === "mcq" ? (
                <>
                  <Label text="Options, one a line (2 to 6)">
                    <textarea
                      className="w-full rounded-control border border-home/15 bg-white/80 p-3 text-sm"
                      rows={4}
                      value={d.options}
                      onChange={(e) => update(i, { options: e.target.value })}
                    />
                  </Label>
                  <Label text="Right option (its number, starting at 1)">
                    <TextInput type="number" min={1} max={6} value={d.rightOption} onChange={(e) => update(i, { rightOption: Number(e.target.value) })} />
                  </Label>
                  <p className="text-xs text-mute">A wrong option can carry a tag: misread, concept, or none. Tags are optional.</p>
                  {d.options
                    .split("\n")
                    .map((o) => o.trim())
                    .filter((o) => o.length > 0)
                    .map((opt, n) =>
                      n + 1 === d.rightOption ? null : (
                        <Label key={n} text={`Tag for "${opt}"`}>
                          <SelectInput value={d.tags[n] ?? ""} onChange={(e) => update(i, { tags: Object.assign([...d.tags], { [n]: e.target.value }) })}>
                            <option value="">No tag</option>
                            <option value="misread">Misread</option>
                            <option value="concept">Concept slip</option>
                          </SelectInput>
                        </Label>
                      ),
                    )}
                </>
              ) : (
                <>
                  <Label text="Maximum marks (1 to 100)">
                    <TextInput type="number" min={1} max={100} value={d.maxMarks} onChange={(e) => update(i, { maxMarks: Number(e.target.value) })} />
                  </Label>
                  <Label text="Rubric (what earns the marks)">
                    <TextInput value={d.rubric} onChange={(e) => update(i, { rubric: e.target.value })} required maxLength={500} />
                  </Label>
                </>
              )}
              <Label text="Hint for the student (optional, up to 300 characters, and it must not give the answer away)">
                <TextInput value={d.hint} onChange={(e) => update(i, { hint: e.target.value })} maxLength={300} />
              </Label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => setDrafts((list) => [...list, blankMcq()])}>
              Add multiple choice
            </Button>
            <Button variant="quiet" onClick={() => setDrafts((list) => [...list, blankLong()])}>
              Add long answer
            </Button>
          </div>
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
          <Button type="submit" disabled={busy}>
            Save paper
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Send a paper to a class</h2>
        <form onSubmit={sendPaper} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label text="Paper">
            <SelectInput data-testid="send-paper" value={paperId} onChange={(e) => setPaperId(e.target.value as GenericId<"papers">)}>
              <option value="">Choose a paper</option>
              {mine?.map((p) => (
                <option key={p.paperId} value={p.paperId}>
                  {p.title} ({p.status})
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text="Class">
            <SelectInput data-testid="send-class" value={classId} onChange={(e) => setClassId(e.target.value as GenericId<"classes">)}>
              <option value="">Choose a class</option>
              {classes.results.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.grade} {c.section}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text="Opens">
            <TextInput data-testid="send-opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} required />
          </Label>
          <Label text="Due">
            <TextInput data-testid="send-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
          </Label>
          <div className="sm:col-span-2">
            <Button type="submit">Send</Button>
          </div>
        </form>
      </Card>

      {paperId && <Marking paperId={paperId} />}
      <Reviews />
      <HourReview />
    </div>
  );
}

// Marking: the attempts of one paper. A teacher reads each student's answers, gives a mark to each long answer with remarks, and confirms. Named
// results open through a mutation (house spec 0005): every open leaves a record the student can see in Your data, so the screen opens once, again
// after each change, and when the teacher asks, and it is not live.
const STATUS_WORDS: Record<string, string> = {
  assigned: "Not started",
  open: "In progress",
  submitted: "Submitted",
  marked: "Marked, not yet confirmed",
  confirmed: "Confirmed",
};

type Attempt = FunctionReturnType<typeof api.papers.openForTeacher>["attempts"][number];

function Marking({ paperId }: { paperId: GenericId<"papers"> }) {
  const open = useMutation(api.papers.openForTeacher);
  const markLong = useMutation(api.papers.markLong);
  const confirm = useMutation(api.papers.confirm);
  const [view, setView] = useState<FunctionReturnType<typeof api.papers.openForTeacher> | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [marks, setMarks] = useState<Record<string, Record<number, string>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setView(await open({ paperId, page }));
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }, [open, paperId, page]);
  useEffect(() => {
    void load();
  }, [load]);

  if (view === null) return error ? <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">{error}</Notice> : null;
  const longQuestions = view.questions.filter((q) => q.kind === "long");
  // What the box shows: what the teacher typed, or else the mark already saved.
  const markShown = (a: Attempt, question: number) => (marks[a.attemptId] ?? {})[question] ?? String(a.marks.find((m) => m.question === question)?.mark ?? "");
  const remarksShown = (a: Attempt) => remarks[a.attemptId] ?? a.remarks;

  async function save(a: Attempt) {
    setError("");
    const entries = longQuestions.map((q) => ({ question: q.order, mark: Number(markShown(a, q.order) || 0) }));
    try {
      await markLong({ attemptId: a.attemptId, marks: entries, remarks: remarksShown(a) });
      await load();
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }
  async function confirmMark(attemptId: GenericId<"paperAttempts">) {
    setError("");
    try {
      await confirm({ attemptId });
      await load();
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  const pages = Math.max(1, Math.ceil(view.total / 50));
  return (
    <Card className="space-y-3" data-testid="marking">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Marking: {view.title}</h2>
        <Button variant="quiet" onClick={load} data-testid="marking-refresh">
          Refresh
        </Button>
      </div>
      <p className="text-xs text-mute">Each time this page opens, the students shown can see in Your data that a teacher looked at their results.</p>
      {view.total === 0 && <p className="text-sm text-mute">Nobody has been sent this paper yet.</p>}
      {view.total > 0 && view.attempts.length === 0 && <p className="text-sm text-mute">No students of your classes on this page.</p>}
      {view.attempts.map((a) => (
        <div key={a.attemptId} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3" data-testid="marking-attempt">
          <p className="text-sm">
            {a.name} · {a.excused ? "Not sat: the class was paused" : a.missed ? "Missed: nothing was answered" : (STATUS_WORDS[a.status] ?? a.status)}
            {a.status === "confirmed" ? ` · ${a.total}` : ""}
          </p>
          {!a.missed && !a.excused && (a.status === "submitted" || a.status === "marked" || a.status === "confirmed") && (
            <div className="space-y-2">
              {view.questions.map((q) => {
                const given = a.answers.find((x) => x.question === q.order);
                return (
                  <div key={q.order} className="rounded-control bg-white/60 p-2 text-sm">
                    <p className="text-xs text-mute">
                      Question {q.order + 1}: {q.text}
                    </p>
                    {q.kind === "mcq" ? (
                      <p>
                        {given?.choice === undefined ? "No answer" : `${q.options[given.choice] ?? ""} (${given.choice === q.rightOption ? "right" : "not the right option"})`}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap">{given?.text && given.text.trim() !== "" ? given.text : "No answer"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!a.missed && !a.excused && (a.status === "submitted" || a.status === "marked") && (
            <>
              {longQuestions.map((q) => (
                <Label key={q.order} text={`Marks for question ${q.order + 1} (out of ${q.maxMarks}). Rubric: ${q.rubric || "none"}`}>
                  <TextInput
                    type="number"
                    min={0}
                    max={q.maxMarks}
                    value={markShown(a, q.order)}
                    onChange={(e) => setMarks((m) => ({ ...m, [a.attemptId]: { ...(m[a.attemptId] ?? {}), [q.order]: e.target.value } }))}
                  />
                </Label>
              ))}
              <Label text="Remarks">
                <textarea
                  className="w-full rounded-control border border-home/15 bg-white/80 p-3 text-sm"
                  rows={3}
                  maxLength={1000}
                  value={remarksShown(a)}
                  onChange={(e) => setRemarks((r) => ({ ...r, [a.attemptId]: e.target.value }))}
                />
              </Label>
              <Button variant="quiet" onClick={() => save(a)}>
                Save marks
              </Button>
            </>
          )}
          {a.status === "marked" && <Button onClick={() => confirmMark(a.attemptId)}>Confirm mark for the student</Button>}
        </div>
      ))}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="quiet" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous 50
          </Button>
          <span className="text-xs text-mute">
            Page {page + 1} of {pages}
          </span>
          <Button variant="quiet" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next 50
          </Button>
        </div>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
    </Card>
  );
}

// Posts and comments of the teacher's classes that are waiting for review.
function Reviews() {
  const pending = useQuery(api.blog.pendingForTeacher, {});
  const review = useMutation(api.blog.review);
  const reviewComment = useMutation(api.blog.reviewComment);
  const [error, setError] = useState("");

  async function act(kind: "post" | "comment", id: string, action: "approve" | "hide" | "remove") {
    setError("");
    try {
      if (kind === "post") await review({ postId: id as GenericId<"blogPosts">, action });
      else await reviewComment({ commentId: id as GenericId<"blogComments">, action });
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  if (pending === undefined) return null;
  return (
    <Card className="space-y-3" data-testid="reviews">
      <h2 className="text-sm font-semibold">Waiting for review</h2>
      {pending.posts.length === 0 && pending.comments.length === 0 && <p className="text-sm text-mute">Nothing is waiting.</p>}
      {pending.posts.map((p) => (
        <div key={p.postId} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3">
          <p className="text-sm font-medium">
            {p.title} · {p.authorName} · {p.tag}
          </p>
          <div className="whitespace-pre-line text-sm" dangerouslySetInnerHTML={{ __html: p.body }} />
          {p.photoUrl && <img src={p.photoUrl} alt={`The picture on the post "${p.title}"`} loading="lazy" className="max-h-60 rounded-control" data-testid="review-photo" />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act("post", p.postId, "approve")}>Approve</Button>
            <Button variant="quiet" onClick={() => act("post", p.postId, "hide")}>
              Hide
            </Button>
            <Button variant="quiet" onClick={() => act("post", p.postId, "remove")}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      {pending.comments.map((c) => (
        <div key={c.commentId} className="space-y-2 rounded-control border border-home/15 bg-white/70 p-3">
          <p className="text-sm">
            Comment by {c.authorName} on "{c.postTitle}": <span dangerouslySetInnerHTML={{ __html: c.text }} />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act("comment", c.commentId, "approve")}>Approve</Button>
            <Button variant="quiet" onClick={() => act("comment", c.commentId, "remove")}>
              Remove
            </Button>
          </div>
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
