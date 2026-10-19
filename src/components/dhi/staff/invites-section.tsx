import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { Label, ListEmpty, Outcome, Pager, SelectInput, TextInput, useScope, type ClassId, type InviteId } from "@/components/dhi/staff/staff-parts";
import { ROLE_LABEL, codeOf, refusalWords } from "@/lib/dhi/house-words";
import type { HouseRole } from "@/lib/entry";

// The one plain address everyone joins at (spec house/0002). Staff share it by WhatsApp or in class; there is no secret code.
const joinAddress = () => (typeof window === "undefined" ? "/join" : `${window.location.origin}/join`);

// Roles this person may invite: a DHI admin anyone, an institute admin teachers and students, a teacher students.
function rolesFor(role: HouseRole): HouseRole[] {
  if (role === "dhi_admin") return ["institute_admin", "teacher", "student", "counselor", "dhi_admin"];
  if (role === "institute_admin") return ["teacher", "student"];
  if (role === "teacher") return ["student"];
  return [];
}

// Invites (spec house/0002). Make one, and extend, fix or clear the pending ones. A person joins by signing in with the invited Google email
// and pressing Join. A DHI admin's invites for counselors and other DHI admins belong to no institute.
export function InvitesSection() {
  const scope = useScope();
  const roles = rolesFor(scope.role);
  const classArgs = scope.needsInstitute ? "skip" : { instituteId: scope.instituteId };
  const classes = usePaginatedQuery(api.classes.list, classArgs, { initialNumItems: 25 });
  const [status, setStatus] = useState<"pending" | "claimed" | "revoked" | "">("pending");
  const [listClass, setListClass] = useState<ClassId | "">("");

  // A teacher names one of their classes to list; everyone else lists their scope.
  const teacherClass = listClass || (scope.role === "teacher" ? (classes.results[0]?._id ?? "") : "");
  const listArgs =
    scope.role === "teacher" && !teacherClass
      ? "skip"
      : {
          ...(scope.instituteId ? { instituteId: scope.instituteId } : {}),
          ...(teacherClass ? { classId: teacherClass } : {}),
          ...(status ? { status } : {}),
        };
  const invites = usePaginatedQuery(api.invites.list, listArgs, { initialNumItems: 25 });
  const create = useMutation(api.invites.create);
  const extend = useMutation(api.invites.extend);
  const revoke = useMutation(api.invites.revoke);
  const update = useMutation(api.invites.update);

  const [role, setRole] = useState<HouseRole>(roles[0] ?? "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState<ClassId | "">("");
  const [under18, setUnder18] = useState<"" | "yes" | "no">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [editing, setEditing] = useState<InviteId | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [now] = useState(() => Date.now());

  const needsClass = role === "student";
  const needsInstitute = scope.role === "dhi_admin" && role !== "counselor" && role !== "dhi_admin" && !scope.instituteId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    const result = await create({
      role,
      name,
      email,
      ...(needsClass && classId ? { classId } : {}),
      ...(needsClass && under18 ? { under18: under18 === "yes" } : {}),
      ...(scope.instituteId && role !== "counselor" && role !== "dhi_admin" ? { instituteId: scope.instituteId } : {}),
    }).catch((err: unknown) => ({ ok: false as const, code: codeOf(err) ?? "forbidden" }));
    if (result.ok) {
      setDone(`Invite made. Share this address: ${joinAddress()}`);
      setName("");
      setEmail("");
    } else {
      setError(refusalWords(result.code));
    }
  }

  async function act(call: () => Promise<unknown>, ok: string) {
    setError("");
    setDone("");
    try {
      const result = (await call()) as { ok?: boolean; code?: string } | undefined;
      if (result && result.ok === false) setError(refusalWords(result.code));
      else setDone(ok);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  if (roles.length === 0) return <ListEmpty>Invites are made by staff.</ListEmpty>;

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold">Invite someone</h2>
        {needsInstitute && <p className="mt-2 text-sm text-mute">Open an institute first, or choose a counselor or DHI admin, who belong to no institute.</p>}
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="invite-form">
          <Label text="Role">
            <SelectInput value={role} onChange={(e) => setRole(e.target.value as HouseRole)} data-testid="invite-role">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} data-testid="invite-name" />
          </Label>
          <Label text="Google email" className="sm:col-span-2">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@school.edu" data-testid="invite-email" />
          </Label>
          {needsClass && (
            <>
              <Label text="Class">
                <SelectInput value={classId} onChange={(e) => setClassId(e.target.value as ClassId | "")} required data-testid="invite-class">
                  <option value="">Choose a class</option>
                  {classes.results
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.grade} {c.section}
                      </option>
                    ))}
                </SelectInput>
              </Label>
              <Label text="Under 18?">
                <SelectInput value={under18} onChange={(e) => setUnder18(e.target.value as "" | "yes" | "no")} required data-testid="invite-under18">
                  <option value="">Choose</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </SelectInput>
              </Label>
            </>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={needsInstitute} data-testid="invite-create" className="max-sm:w-full">
              Make invite
            </Button>
          </div>
        </form>
        <div className="mt-3 empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Invites</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {scope.role === "teacher" && (
            <Label text="Class" className="w-44">
              <SelectInput value={teacherClass} onChange={(e) => setListClass(e.target.value as ClassId | "")}>
                {classes.results.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.grade} {c.section}
                  </option>
                ))}
              </SelectInput>
            </Label>
          )}
          <Label text="Show" className="w-40">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as typeof status)} data-testid="invite-status">
              <option value="pending">Waiting</option>
              <option value="claimed">Joined</option>
              <option value="revoked">Cleared</option>
              <option value="">All</option>
            </SelectInput>
          </Label>
        </div>
        {invites.status === "LoadingFirstPage" ? (
          <p className="mt-3 text-sm text-mute">Loading…</p>
        ) : invites.results.length === 0 ? (
          <div className="mt-3">
            <ListEmpty>No invites to show.</ListEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="invite-list">
            {invites.results.map((i) => {
              const expired = i.status === "pending" && now > i.expiresAt;
              return (
                <li key={i._id} className="rounded-control bg-white/80 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="truncate text-xs text-mute touch:text-sm">
                        {i.email} · {ROLE_LABEL[i.role]}
                        {i.className ? ` · ${i.className}` : ""}
                      </p>
                    </div>
                    {i.under18 === true && <Chip tone="lilac">Under 18</Chip>}
                    <Chip tone={i.status === "claimed" ? "mint" : i.status === "revoked" ? "gold" : "lilac"}>
                      {i.status === "claimed" ? "Joined" : i.status === "revoked" ? "Cleared" : expired ? "Run out" : "Waiting"}
                    </Chip>
                  </div>
                  {i.status === "pending" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button variant="quiet" onClick={() => act(() => extend({ inviteId: i._id }), "Another 14 days given.")} aria-label={`Extend the invite for ${i.name}`}>
                        Extend
                      </Button>
                      <Button variant="quiet" onClick={() => { setEditing(editing === i._id ? null : i._id); setNewEmail(i.email); }} aria-label={`Fix the email for ${i.name}`}>
                        Fix email
                      </Button>
                      <Button variant="quiet" onClick={() => act(() => revoke({ inviteId: i._id }), "Invite cleared.")} aria-label={`Clear the invite for ${i.name}`}>
                        Clear
                      </Button>
                    </div>
                  )}
                  {editing === i._id && (
                    <form
                      className="mt-2 flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(() => update({ inviteId: i._id, email: newEmail }), "Email fixed.").then(() => setEditing(null));
                      }}
                    >
                      <Label text="New email" className="min-w-48 flex-1">
                        <TextInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                      </Label>
                      <Button type="submit">Save</Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pager status={invites.status} onMore={() => invites.loadMore(25)} />
      </Card>
    </div>
  );
}
