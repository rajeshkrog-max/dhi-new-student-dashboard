import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { StudentPapers } from "@/components/dhi/staff/student-papers";
import { ChooseInstitute, Label, ListEmpty, Outcome, Pager, SelectInput, useScope, type ClassId, type InstituteId, type MemberId } from "@/components/dhi/staff/staff-parts";
import { ROLE_LABEL, codeOf, refusalWords } from "@/lib/dhi/house-words";
import type { HouseRole } from "@/lib/entry";

const ROLES: HouseRole[] = ["student", "teacher", "institute_admin", "dhi_admin", "counselor"];

// People (spec house/0002). A teacher names one of their classes and sees its students. An institute admin sees their institute and may remove,
// bring back and move people. A DHI admin also corrects the under 18 flag. Removing locks a person out and leaves everything they own alone.
export function PeopleSection() {
  const scope = useScope();
  const isAdmin = scope.role === "institute_admin" || scope.role === "dhi_admin";
  const isDhi = scope.role === "dhi_admin";
  const classArgs = scope.needsInstitute ? "skip" : { instituteId: scope.instituteId };
  const classes = usePaginatedQuery(api.classes.list, classArgs, { initialNumItems: 25 });
  const [classId, setClassId] = useState<ClassId | "">("");
  const [role, setRole] = useState<HouseRole | "">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [papersOf, setPapersOf] = useState<{ id: MemberId; name: string } | null>(null);
  const remove = useMutation(api.members.remove);
  const reinstate = useMutation(api.members.reinstate);
  const setClass = useMutation(api.members.setClass);
  const setUnder18 = useMutation(api.members.setUnder18);
  const moveStaff = useMutation(api.members.moveStaff);
  const institutes = usePaginatedQuery(api.institutes.list, isDhi ? {} : "skip", { initialNumItems: 50 });

  // A teacher always has a class chosen: the first of theirs, until they pick another.
  const effectiveClass = classId || (scope.role === "teacher" ? (classes.results[0]?._id ?? "") : "");
  const listArgs =
    scope.needsInstitute || (scope.role === "teacher" && !effectiveClass)
      ? "skip"
      : {
          ...(scope.instituteId ? { instituteId: scope.instituteId } : {}),
          ...(effectiveClass ? { classId: effectiveClass } : {}),
          ...(role && !effectiveClass ? { role } : {}),
        };
  const people = usePaginatedQuery(api.members.list, listArgs, { initialNumItems: 25 });

  if (scope.needsInstitute && isDhi) return <ChooseInstitute />;

  async function run(call: () => Promise<unknown>, ok: string) {
    setError("");
    setDone("");
    try {
      await call();
      setDone(ok);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text={scope.role === "teacher" ? "Class" : "Show people of a class"}>
            <SelectInput value={effectiveClass} onChange={(e) => setClassId(e.target.value as ClassId | "")} data-testid="people-class">
              {scope.role !== "teacher" && <option value="">Everyone</option>}
              {classes.results.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.grade} {c.section}
                </option>
              ))}
            </SelectInput>
          </Label>
          {isAdmin && !effectiveClass && (
            <Label text="Show a role">
              <SelectInput value={role} onChange={(e) => setRole(e.target.value as HouseRole | "")} data-testid="people-role">
                <option value="">All roles</option>
                {ROLES.filter((r) => isDhi || r === "student" || r === "teacher" || r === "institute_admin").map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </SelectInput>
            </Label>
          )}
        </div>
        <div className="mt-3 empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">{scope.role === "teacher" ? "Your students" : "People"}</h2>
        {people.status === "LoadingFirstPage" ? (
          <p className="mt-3 text-sm text-mute">Loading…</p>
        ) : people.results.length === 0 ? (
          <div className="mt-3">
            <ListEmpty>{scope.role === "teacher" && !effectiveClass ? "You have no classes yet." : "Nobody here yet. People appear after they press Join."}</ListEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="people-list">
            {people.results.map((m) => (
              <li key={m._id} className="rounded-control bg-white/80 px-3 py-2.5" data-person={m.role}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-mute touch:text-sm">
                      {m.email} · {ROLE_LABEL[m.role]}
                      {m.className ? ` · ${m.className}` : ""}
                    </p>
                  </div>
                  {m.under18 === true && <Chip tone="lilac">Under 18</Chip>}
                  {m.waiting === "parent" && <Chip tone="gold">Waits for parent consent</Chip>}
                  {m.waiting === "self" && <Chip tone="gold">Has not agreed yet</Chip>}
                  {m.status === "removed" && <Chip tone="gold">Paused</Chip>}
                  {scope.role === "teacher" && m.role === "student" && m.status === "active" && (
                    <Button variant="quiet" onClick={() => setPapersOf({ id: m._id as MemberId, name: m.name })} aria-label={`Papers of ${m.name}`} data-testid="student-papers-open">
                      Papers
                    </Button>
                  )}
                </div>
                {isAdmin && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {m.status === "active" ? (
                      <Button variant="quiet" onClick={() => run(() => remove({ memberId: m._id }), `${m.name} is paused.`)} aria-label={`Pause ${m.name}`}>
                        Pause
                      </Button>
                    ) : (
                      <Button variant="quiet" onClick={() => run(() => reinstate({ memberId: m._id }), `${m.name} is back.`)} aria-label={`Bring back ${m.name}`}>
                        Bring back
                      </Button>
                    )}
                    {m.role === "student" && (
                      <SelectInput
                        aria-label={`Move ${m.name} to a class`}
                        className="w-auto max-w-48"
                        value={m.classId ?? ""}
                        onChange={(e) => e.target.value && run(() => setClass({ memberId: m._id as MemberId, classId: e.target.value as ClassId }), `${m.name} moved.`)}
                      >
                        {classes.results
                          .filter((c) => !c.archived || c._id === m.classId)
                          .map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.grade} {c.section}
                            </option>
                          ))}
                      </SelectInput>
                    )}
                    {isDhi && m.status === "active" && (m.role === "teacher" || m.role === "institute_admin") && (
                      <SelectInput
                        aria-label={`Move ${m.name} to another institute`}
                        className="w-auto max-w-48"
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          run(() => moveStaff({ memberId: m._id, instituteId: e.target.value as InstituteId }), `${m.name} moved. Their classes here were cleared.`)
                        }
                      >
                        <option value="">Move to institute…</option>
                        {institutes.results
                          .filter((i) => i.status === "active")
                          .map((i) => (
                            <option key={i._id} value={i._id}>
                              {i.name}
                            </option>
                          ))}
                      </SelectInput>
                    )}
                    {isDhi && m.role === "student" && (
                      <Button
                        variant="quiet"
                        onClick={() => run(() => setUnder18({ memberId: m._id, under18: m.under18 !== true }), "The under 18 flag was changed.")}
                        aria-label={`Change under 18 for ${m.name}`}
                      >
                        {m.under18 === true ? "Mark 18 or over" : "Mark under 18"}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager status={people.status} onMore={() => people.loadMore(25)} />
      </Card>
      {papersOf && <StudentPapers key={papersOf.id} memberId={papersOf.id} name={papersOf.name} onClose={() => setPapersOf(null)} />}
    </div>
  );
}
