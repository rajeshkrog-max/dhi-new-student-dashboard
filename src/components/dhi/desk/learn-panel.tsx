// The desk's Learn panel (house spec 0031; Desk Design D3 to D5). The topics of the student's class by subject and chapter (the map) and a search; a topic
// opens a short page with Practise, going back over wrong answers (Fix), Write an answer and Where is this used; Remember brings back the topics due today.
// Questions are marked on the server, which sends the right option only after the answer. A topic's step says what comes next on it and is never a label
// of the student. The plan for a test is worked out by the server from the student's own topics. Nothing here costs a coin except a written answer the
// desk marks and Where is this used, and a stored answer is free.
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import type { GenericId as Id } from "convex/values";
import { SUBJECTS } from "@dhi/backend/sessionRules";
import { WRITTEN_MAX } from "@dhi/backend/learnRules";
import { subjectWord } from "@/lib/dhi/desk-words";
import {
  ALL_SUBJECTS,
  ASK_TEACHER,
  BACK,
  BY_DESK,
  BY_TEACHER,
  CHECK,
  CLOSE_ROUND,
  DONE,
  DONE_NOTE,
  DUE_NOW,
  FIX,
  FIX_COUNT,
  FIX_TOPIC,
  LEARN_INTRO,
  LEARN_LOADING,
  MARKING,
  MARKS,
  MASTERED,
  MY_ANSWERS,
  NEXT,
  NOT_YET,
  NO_CHAPTER,
  NO_TOPICS,
  OPEN_TOPIC,
  PLAN_DAY,
  PLAN_EMPTY,
  PLAN_FOR,
  PLAN_MAKE,
  PLAN_NONE,
  PLAN_REMOVE,
  PLAN_STEP,
  PLAN_TITLE,
  POINT_WORDS,
  PRACTISE,
  QUESTION_OF,
  REMEMBER,
  RIGHT,
  ROUND_TITLE,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  STEP_WORDS,
  SUBJECT_PICK,
  SUMMARY,
  USE_IT,
  USE_NOTE,
  WAITING,
  WRITTEN,
  WRITTEN_LABEL,
  WRITTEN_NONE,
  WRITTEN_NOTE,
  WRITTEN_PICK,
  WRITTEN_SEND,
  WRITTEN_SENT,
  learnRefusal,
} from "@/lib/dhi/learn-words";
import { CARE_TEXT, deskRefusal } from "@/lib/dhi/desk-words";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

type Topic = { topicId: Id<"paperTopics">; name: string; subject: string; chapter: string | null; step: string; due: boolean; openFix: number };
type Round = { roundId: Id<"learnRounds">; mode: string; questions: { questionId: Id<"paperQuestions">; topic: string; text: string; options: string[] }[] };

const fieldClass = "w-full rounded-control border border-white/80 bg-white/60 p-3 text-sm outline-none placeholder:opacity-70 focus-visible:focus-ring";

// The India day of a moment, YYYY-MM-DD, for the plan's date box.
const indiaDay = (ms: number) => new Date(ms + 5.5 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function LearnPanel({ live }: { live: boolean }) {
  // A query does not read the clock: the screen passes the time it opened, moved on each minute, which only changes which topics read as due.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const [subject, setSubject] = useState<string>("");
  const [search, setSearch] = useState("");
  const summary = useQuery(api.learn.summary, { now });
  const map = useQuery(api.learn.map, { now, ...(subject ? { subject } : {}) });
  const found = useQuery(api.learn.search, search.trim().length > 0 ? { text: search, now } : "skip");
  const start = useMutation(api.learn.start);
  const [open, setOpen] = useState<Topic | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [fail, setFail] = useState("");

  async function begin(mode: string, topicId?: Id<"paperTopics">) {
    setFail("");
    try {
      const r = await start({ mode, ...(topicId ? { topicId } : {}) });
      if (!r.ok) setFail(learnRefusal(r.code));
      else setRound({ roundId: r.roundId, mode, questions: r.questions });
    } catch (error) {
      setFail(learnRefusal(error));
    }
  }

  const topics: Topic[] | undefined = search.trim().length > 0 ? found : map;
  // The open topic is read again from the live list, so its step and counts move after a round.
  const openNow = open ? ([...(map ?? []), ...(found ?? [])].find((t) => t.topicId === open.topicId) ?? open) : null;
  const byChapter = useMemo(() => {
    const groups = new Map<string, Topic[]>();
    for (const t of topics ?? []) {
      const key = t.chapter ?? "";
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [topics]);

  if (summary === undefined) {
    return (
      <p className="text-sm text-mute" data-testid="learn-loading">
        {LEARN_LOADING}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="learn-panel">
      <Card className="space-y-3">
        <p className="text-sm text-mute">{LEARN_INTRO}</p>
        <p className="text-sm" data-testid="learn-summary">
          {SUMMARY(summary.due, summary.openFix, summary.held)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void begin("recall")} data-testid="learn-remember">
            {REMEMBER}
          </Button>
          <Button variant="quiet" onClick={() => void begin("fix")} data-testid="learn-fix">
            {FIX}
          </Button>
        </div>
        {fail && (
          <Notice role="status" data-testid="learn-error" className="px-4 py-3 text-sm">
            {fail}
          </Notice>
        )}
      </Card>

      {round ? (
        <RoundCard round={round} onClose={() => setRound(null)} />
      ) : openNow ? (
        <TopicPage topic={openNow} live={live} now={now} onBack={() => setOpen(null)} onStart={(mode) => void begin(mode, openNow.topicId)} />
      ) : (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs text-ink/70">{SUBJECT_PICK}</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} data-testid="learn-subject">
                <option value="">{ALL_SUBJECTS}</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {subjectWord(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs text-ink/70">{SEARCH_LABEL}</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60} placeholder={SEARCH_PLACEHOLDER} className={fieldClass} data-testid="learn-search" />
            </label>
          </div>
          {topics === undefined ? (
            <p className="text-sm text-mute">{LEARN_LOADING}</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-mute" data-testid="learn-no-topics">
              {NO_TOPICS}
            </p>
          ) : (
            <div className="space-y-3" data-testid="learn-topics">
              {byChapter.map(([chapter, list]) => (
                <section key={chapter || "none"} className="space-y-2">
                  <h3 className="text-xs font-semibold text-mute">{chapter || NO_CHAPTER}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {list.map((t) => (
                      <li key={t.topicId}>
                        <button
                          type="button"
                          onClick={() => setOpen(t)}
                          aria-label={OPEN_TOPIC(t.name)}
                          className="tap flex w-full flex-wrap items-center justify-between gap-2 rounded-control border border-home/15 bg-white/70 px-3 py-2 text-left text-sm hover:bg-home/5"
                          data-testid="learn-topic"
                        >
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-mute">
                            {subjectWord(t.subject)} · {STEP_WORDS[t.step] ?? t.step}
                            {t.due ? ` · ${DUE_NOW}` : ""}
                            {t.openFix > 0 ? ` · ${FIX_COUNT(t.openFix)}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      )}

      <PlanCard now={now} />
      <MyAnswers />
    </div>
  );
}

function TopicPage({ topic, live, now, onBack, onStart }: { topic: Topic; live: boolean; now: number; onBack: () => void; onStart: (mode: string) => void }) {
  const ask = useAction(api.deskAsk.ask);
  const [use, setUse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [writing, setWriting] = useState(false);
  // Read with the page, not when the box opens, so the box draws once at its full height (the sweep's layout shift check).
  const questions = useQuery(api.learnMark.questions, { topicId: topic.topicId, now });

  async function whereUsed() {
    setBusy(true);
    setFail("");
    try {
      const r = await ask({ kind: "use", question: topic.name });
      if (!r.ok) setFail(deskRefusal(r.code));
      else if (r.care) setFail(CARE_TEXT);
      else setUse(r.answer);
    } catch (error) {
      setFail(deskRefusal(error));
    }
    setBusy(false);
  }

  return (
    <Card className="space-y-3" data-testid="learn-topic-page">
      <Button variant="link" onClick={onBack} data-testid="learn-back">
        {BACK}
      </Button>
      <div>
        <h3 className="text-base font-semibold">{topic.name}</h3>
        <p className="text-xs text-mute">
          {subjectWord(topic.subject)}
          {topic.chapter ? ` · ${topic.chapter}` : ""} · {STEP_WORDS[topic.step] ?? topic.step}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onStart("practice")} data-testid="learn-practise">
          {PRACTISE}
        </Button>
        {topic.openFix > 0 && (
          <Button variant="quiet" onClick={() => onStart("fix")} data-testid="learn-fix-topic">
            {FIX_TOPIC}
          </Button>
        )}
        <Button variant="quiet" onClick={() => setWriting((x) => !x)} aria-expanded={writing} data-testid="learn-write">
          {WRITTEN}
        </Button>
        <Button variant="quiet" onClick={() => void whereUsed()} disabled={busy || !live} data-testid="learn-use">
          {USE_IT}
        </Button>
      </div>
      <p className="text-xs text-mute">{USE_NOTE}</p>
      {fail && (
        <Notice role="status" className="px-4 py-3 text-sm" data-testid="learn-topic-error">
          {fail}
        </Notice>
      )}
      {use && (
        <p className="rounded-control bg-white/70 p-3 text-sm whitespace-pre-wrap" data-testid="learn-use-answer">
          {use}
        </p>
      )}
      {writing && <WrittenBox questions={questions} />}
    </Card>
  );
}

function RoundCard({ round, onClose }: { round: Round; onClose: () => void }) {
  const answer = useMutation(api.learn.answer);
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<{ right: boolean; rightOption: number; mastered: boolean } | null>(null);
  const [fail, setFail] = useState("");
  const shownAt = useRef(Date.now());
  const q = round.questions[i];
  const done = i >= round.questions.length;

  async function check() {
    if (choice === null || !q) return;
    setFail("");
    try {
      const r = await answer({ roundId: round.roundId, questionId: q.questionId, choice, seconds: (Date.now() - shownAt.current) / 1000 });
      if (!r.ok) setFail(learnRefusal(r.code));
      else setResult({ right: r.right, rightOption: r.rightOption, mastered: r.mastered });
    } catch (error) {
      setFail(learnRefusal(error));
    }
  }
  function next() {
    setI((x) => x + 1);
    setChoice(null);
    setResult(null);
    shownAt.current = Date.now();
  }

  return (
    <Card className="space-y-3" data-testid="learn-round" data-mode={round.mode}>
      <h3 className="text-base font-semibold">{ROUND_TITLE[round.mode] ?? round.mode}</h3>
      {done ? (
        <>
          <p className="text-sm font-medium" data-testid="learn-round-done">
            {DONE}
          </p>
          <p className="text-sm text-mute">{DONE_NOTE}</p>
          <Button onClick={onClose} data-testid="learn-round-close">
            {CLOSE_ROUND}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-mute">
            {QUESTION_OF(i + 1, round.questions.length)} · {q.topic}
          </p>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium whitespace-pre-wrap">{q.text}</legend>
            {q.options.map((o, k) => (
              <label key={k} className="tap flex items-center gap-3 rounded-control border border-home/15 bg-white/70 px-3 py-2 text-sm">
                <input type="radio" name={`q-${q.questionId}`} checked={choice === k} disabled={result !== null} onChange={() => setChoice(k)} data-testid="learn-option" />
                <span>{o}</span>
              </label>
            ))}
          </fieldset>
          {result && (
            <Notice role="status" tone={result.right ? undefined : "danger"} className="px-4 py-3 text-sm" data-testid="learn-result" data-right={result.right ? "yes" : "no"}>
              {result.right ? RIGHT : NOT_YET(q.options[result.rightOption] ?? "")}
              {result.mastered ? ` ${MASTERED}` : ""}
            </Notice>
          )}
          {fail && (
            <Notice role="alert" tone="danger" className="px-4 py-3 text-sm">
              {fail}
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            {result ? (
              <Button onClick={next} data-testid="learn-next">
                {NEXT}
              </Button>
            ) : (
              <Button onClick={() => void check()} disabled={choice === null} data-testid="learn-check">
                {CHECK}
              </Button>
            )}
            <Button variant="quiet" onClick={onClose}>
              {CLOSE_ROUND}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function WrittenBox({ questions }: { questions: { questionId: Id<"paperQuestions">; text: string; maxMarks: number }[] | undefined }) {
  const submit = useAction(api.learnMark.submit);
  const [pick, setPick] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (questions === undefined) return <p className="text-sm text-mute">{LEARN_LOADING}</p>;
  if (questions.length === 0)
    return (
      <p className="text-sm text-mute" data-testid="learn-written-none">
        {WRITTEN_NONE}
      </p>
    );
  const chosen = questions.find((q) => q.questionId === pick) ?? questions[0];

  async function send() {
    setBusy(true);
    setNote("");
    try {
      const r = await submit({ questionId: chosen.questionId, text });
      if (!r.ok) setNote(learnRefusal(r.code));
      else if (r.care) setNote(CARE_TEXT);
      else {
        setNote(WRITTEN_SENT[r.status] ?? "");
        setText("");
      }
    } catch (error) {
      setNote(learnRefusal(error));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-control border border-home/15 p-3" data-testid="learn-written">
      {questions.length > 1 && (
        <label className="block">
          <span className="mb-2 block text-xs text-ink/70">{WRITTEN_PICK}</span>
          <select value={chosen.questionId} onChange={(e) => setPick(e.target.value)} className={fieldClass}>
            {questions.map((q) => (
              <option key={q.questionId} value={q.questionId}>
                {q.text.slice(0, 80)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-sm font-medium whitespace-pre-wrap">{chosen.text}</p>
      <label className="block">
        <span className="mb-2 block text-xs text-ink/70">{WRITTEN_LABEL}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={WRITTEN_MAX} rows={6} className={fieldClass} data-testid="learn-written-input" />
      </label>
      <Button onClick={() => void send()} disabled={busy || text.trim().length === 0} data-testid="learn-written-send">
        {busy ? MARKING : WRITTEN_SEND}
      </Button>
      <p className="text-xs text-mute">{WRITTEN_NOTE}</p>
      {note && (
        <p className="text-sm" role="status" data-testid="learn-written-note">
          {note}
        </p>
      )}
    </div>
  );
}

function MyAnswers() {
  const mine = useQuery(api.learnMark.mine, {});
  const dispute = useMutation(api.learnMark.dispute);
  if (!mine || mine.length === 0) return null;
  return (
    <Card className="space-y-3" data-testid="learn-my-answers">
      <h3 className="text-sm font-semibold">{MY_ANSWERS}</h3>
      <ul className="space-y-3">
        {mine.map((a) => (
          <li key={a.answerId} className="space-y-1 rounded-control border border-home/15 bg-white/70 p-3 text-sm" data-testid="learn-answer" data-status={a.status}>
            <p className="font-medium whitespace-pre-wrap">{a.question}</p>
            <p className="text-xs text-mute whitespace-pre-wrap">{a.text}</p>
            <p>
              {a.status === "marking" ? MARKING : a.status === "teacher" ? WAITING : MARKS(a.marks, a.maxMarks)}
              {a.status === "marked" ? ` · ${BY_DESK}` : a.byTeacher ? ` · ${BY_TEACHER}` : ""}
            </p>
            {a.points.length > 0 && (
              <ul className="space-y-1 text-xs">
                {a.points.map((p, k) => (
                  <li key={k}>
                    {p.point}
                    {p.state ? `: ${POINT_WORDS[p.state] ?? p.state}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {a.status === "marked" && (
              <Button variant="link" onClick={() => void dispute({ answerId: a.answerId }).catch(() => {})} data-testid="learn-dispute">
                {ASK_TEACHER}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlanCard({ now }: { now: number }) {
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const plan = useQuery(api.learn.plan, { subject, now });
  const setPlan = useMutation(api.learn.setPlan);
  const removePlan = useMutation(api.learn.removePlan);
  const tomorrow = indiaDay(now + 24 * 60 * 60 * 1000);
  const [day, setDay] = useState(tomorrow);
  const [fail, setFail] = useState("");

  async function make() {
    setFail("");
    try {
      const r = await setPlan({ subject, testDay: day });
      if (!r.ok) setFail(learnRefusal(r.code));
    } catch (error) {
      setFail(learnRefusal(error));
    }
  }

  return (
    <Card className="space-y-3" data-testid="learn-plan">
      <h3 className="text-sm font-semibold">{PLAN_TITLE}</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-2 block text-xs text-ink/70">{SUBJECT_PICK}</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} data-testid="learn-plan-subject">
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {subjectWord(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs text-ink/70">{PLAN_DAY}</span>
          <input type="date" value={day} min={tomorrow} onChange={(e) => setDay(e.target.value)} className={fieldClass} data-testid="learn-plan-day" />
        </label>
        <Button onClick={() => void make()} data-testid="learn-plan-make">
          {PLAN_MAKE}
        </Button>
      </div>
      {fail && (
        <Notice role="status" className="px-4 py-3 text-sm">
          {fail}
        </Notice>
      )}
      {plan === undefined ? null : plan === null ? (
        <p className="text-xs text-mute">{PLAN_NONE}</p>
      ) : (
        <div className="space-y-2" data-testid="learn-plan-days">
          <p className="text-sm">{PLAN_FOR(plan.testDay)}</p>
          {plan.days.length === 0 ? (
            <p className="text-xs text-mute">{PLAN_EMPTY}</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {plan.days.map((d) => (
                <li key={d.day} data-testid="learn-plan-day-row">
                  <span className="font-medium">{d.day}</span>: {d.topics.map((t) => `${t.name} (${PLAN_STEP[t.step] ?? t.step})`).join(", ")}
                </li>
              ))}
            </ol>
          )}
          <Button variant="link" onClick={() => void removePlan({ subject }).catch(() => {})}>
            {PLAN_REMOVE}
          </Button>
        </div>
      )}
    </Card>
  );
}
