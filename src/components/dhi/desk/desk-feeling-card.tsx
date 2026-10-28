// The after session card of the desk (spec house/0018, desk part): offered once when a desk sitting of 10 minutes or more has ended. Two taps and an optional
// subject, then an optional topic of that subject from the papers sent to the student's class (house spec 0028), or skip it; a skip changes nothing. The
// server decides when a card exists (`deskSitting.pending`) and writes the event on an answer.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@dhi/backend/api";
import { SUBJECTS } from "@dhi/backend/sessionRules";
import {
  CARD_FAIL,
  CARD_NOTE,
  CARD_SKIP_FAIL,
  CARD_TITLE,
  FEEL_WORDS,
  FOCUS_LABEL,
  PAPER_LABEL,
  SAVE,
  SKIP,
  SUBJECT_LABEL,
  SUBJECT_WORDS,
  TOPIC_LABEL,
  TOPIC_NONE,
} from "@/lib/dhi/desk-words";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

type TopicId = FunctionReturnType<typeof api.topics.forCard>[number]["topicId"];

// The topics of one subject from the papers sent to the student's class, newest first. Tapping the picked one again clears it.
function TopicPick({ subject, topicId, onPick }: { subject: string; topicId: TopicId | null; onPick: (id: TopicId | null) => void }) {
  const topics = useQuery(api.topics.forCard, { subject });
  // The row is drawn at once, with a hidden button holding its height while the list loads, so the desk below does not jump.
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={TOPIC_LABEL} data-testid={topics === undefined ? undefined : "desk-topics"}>
      <span className="text-sm text-mute">{TOPIC_LABEL}</span>
      {topics === undefined && (
        <Button variant="quiet" className="invisible" tabIndex={-1} aria-hidden="true">
          {PAPER_LABEL}
        </Button>
      )}
      {topics?.length === 0 && <span className="text-xs text-mute">{TOPIC_NONE}</span>}
      {(topics ?? []).map((t) => (
        <Button
          key={t.topicId}
          variant={topicId === t.topicId ? "solid" : "quiet"}
          onClick={() => onPick(topicId === t.topicId ? null : t.topicId)}
          data-testid="desk-topic"
          aria-pressed={topicId === t.topicId}
        >
          {t.name}
        </Button>
      ))}
    </div>
  );
}

export function DeskFeelingCard() {
  const card = useQuery(api.deskSitting.pending, {});
  const answer = useMutation(api.deskSitting.answer);
  const skip = useMutation(api.deskSitting.skip);
  const [feel, setFeel] = useState("");
  const [focus, setFocus] = useState(0);
  const [subject, setSubject] = useState("");
  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [error, setError] = useState("");
  if (!card) return null;

  async function save() {
    if (!card) return;
    setError("");
    try {
      const r = await answer({
        sittingId: card.sittingId,
        feel,
        focus,
        ...(subject ? { subject } : {}),
        ...(subject && topicId ? { topicId } : {}),
      });
      if (!r.ok) setError(CARD_FAIL);
    } catch {
      setError(CARD_FAIL);
    }
  }
  async function leaveIt() {
    if (!card) return;
    setError("");
    try {
      await skip({ sittingId: card.sittingId });
    } catch {
      setError(CARD_SKIP_FAIL);
    }
  }

  return (
    <Card className="space-y-3" data-testid="desk-feeling-card">
      <h2 className="text-sm font-semibold">{CARD_TITLE}</h2>
      <p className="text-xs text-mute">{CARD_NOTE(card.minutes)}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={CARD_TITLE}>
        {Object.entries(FEEL_WORDS).map(([key, label]) => (
          <Button
            key={key}
            variant={feel === key ? "solid" : "quiet"}
            onClick={() => setFeel(key)}
            data-testid={`desk-feel-${key}`}
            aria-pressed={feel === key}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={FOCUS_LABEL}>
        <span className="text-sm text-mute">{FOCUS_LABEL}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            variant={focus === n ? "solid" : "quiet"}
            onClick={() => setFocus(n)}
            data-testid={`desk-focus-${n}`}
            aria-pressed={focus === n}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={SUBJECT_LABEL}>
        <span className="text-sm text-mute">{SUBJECT_LABEL}</span>
        {SUBJECTS.map((s) => (
          <Button
            key={s}
            variant={subject === s ? "solid" : "quiet"}
            onClick={() => {
              setSubject(subject === s ? "" : s);
              setTopicId(null);
            }}
            data-testid={`desk-subject-${s}`}
            aria-pressed={subject === s}
          >
            {SUBJECT_WORDS[s]}
          </Button>
        ))}
      </div>
      {subject && <TopicPick subject={subject} topicId={topicId} onPick={setTopicId} />}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!feel || focus === 0} data-testid="desk-feeling-save">
          {SAVE}
        </Button>
        <Button variant="quiet" onClick={leaveIt} data-testid="desk-feeling-skip">
          {SKIP}
        </Button>
      </div>
    </Card>
  );
}
