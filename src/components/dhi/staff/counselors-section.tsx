// The DHI admin's counselor roster (house spec 0026): every counselor with how many times they have open, pause and bring back, invite a new one
// and take back an invite not yet claimed. Never a session, a note or a student.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { Label, Outcome, TextInput } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";
import { STAFF_WORDS, STAFF_WORDS_APPROVED } from "@/lib/dhi/staff-words";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

export function CounselorsSection() {
  const [now] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const roster = useQuery(api.staffHome.counselors, { now });
  const invite = useMutation(api.invites.create);
  const revoke = useMutation(api.invites.revoke);
  const remove = useMutation(api.members.remove);
  const reinstate = useMutation(api.members.reinstate);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(call: () => Promise<unknown>, ok: string) {
    setError("");
    setDone("");
    try {
      const r = (await call()) as { ok?: boolean; code?: string } | null;
      if (r && r.ok === false) setError(refusalWords(r.code));
      else setDone(ok);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="space-y-4" data-testid="staff-counselors">
      {!STAFF_WORDS_APPROVED && <p className="text-xs text-mute">{STAFF_WORDS.draft}</p>}
      <Card className="space-y-3">
        <p className="text-sm text-mute">{STAFF_WORDS.counselorsIntro}</p>
        <div className="empty:hidden">
          <Outcome error={error} done={done} />
        </div>
        {roster === undefined ? (
          <p className="text-sm text-mute">{STAFF_WORDS.loading}</p>
        ) : roster.counselors.length === 0 ? (
          <p className="text-sm text-mute">{STAFF_WORDS.noCounselors}</p>
        ) : (
          <ul className="space-y-2" data-testid="counselor-list">
            {roster.counselors.map((c) => (
              <li key={c.memberId} className="flex flex-wrap items-center gap-2 rounded-control bg-white/80 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-mute touch:text-sm">
                    {c.email} · {STAFF_WORDS.openTimes(c.openTimes)}
                  </p>
                </div>
                {c.status !== "active" && <Chip tone="gold">{STAFF_WORDS.status.removed}</Chip>}
                {c.status === "active" ? (
                  <Button variant="quiet" onClick={() => run(() => remove({ memberId: c.memberId }), STAFF_WORDS.paused(c.name))} aria-label={`${STAFF_WORDS.pause} ${c.name}`}>
                    {STAFF_WORDS.pause}
                  </Button>
                ) : (
                  <Button variant="quiet" onClick={() => run(() => reinstate({ memberId: c.memberId }), STAFF_WORDS.back(c.name))} aria-label={`${STAFF_WORDS.bringBack} ${c.name}`}>
                    {STAFF_WORDS.bringBack}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">{STAFF_WORDS.inviteTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text={STAFF_WORDS.name}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} data-testid="counselor-name" />
          </Label>
          <Label text={STAFF_WORDS.email}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="counselor-email" />
          </Label>
        </div>
        <Button
          disabled={!name.trim() || !email.trim()}
          data-testid="counselor-invite"
          onClick={() =>
            run(async () => {
              const r = await invite({ role: "counselor", email, name });
              if (r.ok) {
                setName("");
                setEmail("");
              }
              return r;
            }, STAFF_WORDS.invited(name))
          }
        >
          {STAFF_WORDS.invite}
        </Button>
        {roster && roster.invites.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-mute">{STAFF_WORDS.pendingTitle}</h3>
            <ul className="space-y-2" data-testid="counselor-invites">
              {roster.invites.map((i) => (
                <li key={i.inviteId} className="flex flex-wrap items-center gap-2 rounded-control bg-white/80 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {i.name} · {i.email} · {STAFF_WORDS.ends(day(i.expiresAt))}
                  </span>
                  <Button variant="quiet" onClick={() => run(() => revoke({ inviteId: i.inviteId }), STAFF_WORDS.revoke)} aria-label={`${STAFF_WORDS.revoke} ${i.name}`}>
                    {STAFF_WORDS.revoke}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
