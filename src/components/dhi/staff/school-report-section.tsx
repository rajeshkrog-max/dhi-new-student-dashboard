// The school report (house spec 0025), for the institute admin (any class of the institute) and a teacher (their own classes). Class totals from the
// papers only, a topic heat map by week, the re-teach suggestions and the academic support list (A to Z, a reason each). It opens through a mutation
// because the support list is named data: each open leaves a record for the listed students, so the screen opens on the person's press, not live.
// The room counts are the institute admin's alone, for the last full month.
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, SelectInput, TextInput, useScope } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";
import { SCHOOL_WORDS, SCHOOL_WORDS_APPROVED } from "@/lib/dhi/school-words";
import { subjectWord } from "@/lib/dhi/desk-words";

type Report = Extract<FunctionReturnType<typeof api.schoolReport.forClass>, { subjects: unknown }>;
type Counts = FunctionReturnType<typeof api.schoolReport.roomCounts>;

const indiaDay = (ms: number) => new Date(ms + 5.5 * 3600_000 - 4 * 3600_000).toISOString().slice(0, 10);
const lastFullMonth = () => {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const BAND: Record<string, string> = { low: "bg-peach", mid: "bg-gold/70", high: "bg-mint" };

export function SchoolReportSection({ role }: { role: string }) {
  const scope = useScope();
  const classes = usePaginatedQuery(api.classes.list, scope.needsInstitute ? "skip" : { instituteId: scope.instituteId }, { initialNumItems: 50 });
  const openReport = useMutation(api.schoolReport.forClass);
  const openCounts = useMutation(api.schoolReport.roomCounts);
  const [classId, setClassId] = useState<GenericId<"classes"> | "">("");
  const [fromDay, setFromDay] = useState(() => indiaDay(Date.now() - 27 * 86_400_000));
  const [toDay, setToDay] = useState(() => indiaDay(Date.now()));
  const [report, setReport] = useState<Report | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    if (!classId) return;
    setBusy(true);
    setError("");
    try {
      const r = await openReport({ classId, fromDay, toDay });
      if ("subjects" in r) setReport(r);
      else {
        setReport(null);
        setError(SCHOOL_WORDS.refusals[r.code] ?? refusalWords(r.code));
      }
      if (role === "institute_admin") setCounts(await openCounts({ classId, month: lastFullMonth() }));
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="school-report">
      {!SCHOOL_WORDS_APPROVED && <p className="text-xs text-mute">{SCHOOL_WORDS.draft}</p>}
      <Card className="space-y-3">
        <p className="text-sm text-mute">{SCHOOL_WORDS.intro}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Label text={SCHOOL_WORDS.className}>
            <SelectInput
              data-testid="school-class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value as GenericId<"classes">);
                setReport(null);
                setCounts(null);
              }}
            >
              <option value="">Choose a class</option>
              {classes.results.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.grade} {c.section}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text={SCHOOL_WORDS.from}>
            <TextInput type="date" value={fromDay} max={toDay} onChange={(e) => setFromDay(e.target.value)} data-testid="school-from" />
          </Label>
          <Label text={SCHOOL_WORDS.to}>
            <TextInput type="date" value={toDay} min={fromDay} onChange={(e) => setToDay(e.target.value)} data-testid="school-to" />
          </Label>
          <Button disabled={!classId || busy} onClick={open} data-testid="school-open">
            {busy ? SCHOOL_WORDS.loading : report ? SCHOOL_WORDS.refresh : SCHOOL_WORDS.open}
          </Button>
        </div>
        <p className="text-xs text-mute">{SCHOOL_WORDS.lookNotice}</p>
      </Card>

      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm" data-testid="school-error">
          {error}
        </Notice>
      )}
      {report && <ReportView report={report} />}
      {counts && <RoomCounts counts={counts} />}
    </div>
  );
}

function ReportView({ report: r }: { report: Report }) {
  return (
    <>
      <Card className="space-y-1" data-testid="school-totals">
        <h2 className="text-sm font-semibold">{r.className}</h2>
        <p className="text-sm">{SCHOOL_WORDS.students(r.students)}</p>
        <p className="text-sm">{SCHOOL_WORDS.papers(r.papers)}</p>
        {r.papers === 0 ? (
          <p className="text-sm text-mute">{SCHOOL_WORDS.noPapers}</p>
        ) : (
          <p className="text-sm">
            {SCHOOL_WORDS.sat(r.sat, r.closed)} · {SCHOOL_WORDS.missed(r.missed)}
            {r.excused > 0 ? ` · ${SCHOOL_WORDS.excused(r.excused)}` : ""}
          </p>
        )}
      </Card>

      {r.subjects.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">{SCHOOL_WORDS.subjectsTitle}</h2>
          <div className="overflow-x-auto focus-visible:focus-ring" data-scroll-x tabIndex={0} role="region" aria-label={SCHOOL_WORDS.subjectsTitle}>
            <table className="w-full text-sm" data-testid="school-subjects">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th className="py-1 pr-3 font-medium">{SCHOOL_WORDS.subject}</th>
                  <th className="py-1 pr-3 font-medium">{SCHOOL_WORDS.share}</th>
                  <th className="py-1 font-medium">{SCHOOL_WORDS.change}</th>
                </tr>
              </thead>
              <tbody>
                {r.subjects.map((s) => (
                  <tr key={s.subject} className="border-t border-home/10">
                    <td className="py-1 pr-3">{subjectWord(s.subject)}</td>
                    <td className="py-1 pr-3">{s.pct === null ? SCHOOL_WORDS.fewer : `${s.pct}%`}</td>
                    <td className="py-1">{s.change === null ? "" : `${s.change > 0 ? "+" : ""}${s.change}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {r.topics.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">{SCHOOL_WORDS.heatTitle}</h2>
          <p className="text-xs text-mute">{SCHOOL_WORDS.heatKey}</p>
          <div className="overflow-x-auto focus-visible:focus-ring" data-scroll-x tabIndex={0} role="region" aria-label={SCHOOL_WORDS.heatTitle}>
            <table className="text-sm" data-testid="school-heat">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th className="py-1 pr-3 font-medium">{SCHOOL_WORDS.topic}</th>
                  {r.weeks.map((w) => (
                    <th key={w} className="px-1 py-1 font-medium whitespace-nowrap">
                      {SCHOOL_WORDS.week(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.topics.map((t) => (
                  <tr key={`${t.subject}-${t.topic}`} className="border-t border-home/10">
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {t.topic} <span className="text-xs text-mute">({subjectWord(t.subject)})</span>
                    </td>
                    {t.cells.map((c) => (
                      <td key={c.week} className="px-1 py-1">
                        <span className={`block min-w-14 rounded-control px-2 py-1 text-center ${c.band ? BAND[c.band] : "bg-sand"}`}>{c.pct === null ? "" : `${c.pct}%`}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="space-y-2" data-testid="school-actions">
        <h2 className="text-sm font-semibold">{SCHOOL_WORDS.actionsTitle}</h2>
        {r.actions.length === 0 ? (
          <p className="text-sm text-mute">{SCHOOL_WORDS.noActions}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.actions.map((a) => (
              <li key={`${a.subject}-${a.topic}`}>{SCHOOL_WORDS.reteach(a.topic, subjectWord(a.subject), a.pct, a.gain)}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2" data-testid="school-support">
        <h2 className="text-sm font-semibold">{SCHOOL_WORDS.supportTitle}</h2>
        <p className="text-xs text-mute">{SCHOOL_WORDS.supportAbout}</p>
        {r.support.length === 0 ? (
          <p className="text-sm text-mute">{SCHOOL_WORDS.noSupport}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.support.map((s, i) => (
              <li key={`${s.name}-${i}`} data-testid="school-support-row">
                <span className="font-medium">{s.name}</span>: {s.reasons.map((x) => SCHOOL_WORDS.reasons[x] ?? x).join("; ")}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RoomCounts({ counts }: { counts: Counts }) {
  return (
    <Card className="space-y-2" data-testid="school-rooms">
      <h2 className="text-sm font-semibold">{SCHOOL_WORDS.roomsTitle}</h2>
      <p className="text-xs text-mute">{SCHOOL_WORDS.roomsAbout}</p>
      <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
        {counts.map((c) => (
          <li key={c.kind}>
            {SCHOOL_WORDS.rooms[c.kind] ?? c.kind}: {c.count === null ? SCHOOL_WORDS.roomsHidden : c.count}
          </li>
        ))}
      </ul>
    </Card>
  );
}
