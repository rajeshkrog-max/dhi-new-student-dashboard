// The DHI desk's coins, for DHI (spec house/0016, AC-5). Only a DHI admin sees this and only the server accepts it: the coins every student gets each
// month, from 0 to 1000. A change counts from each student's next top up (the first time they open the desk in a new month). Nothing here shows a
// student's balance, questions or answers.
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { MAX_MONTHLY_COINS } from "@dhi/backend/deskRules";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, TextInput } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

const WORDS: Record<string, string> = {
  bad_amount: `Please give a whole number from 0 to ${MAX_MONTHLY_COINS}.`,
};
const wordFor = (error: unknown): string =>
  WORDS[codeOf(error) ?? ""] ?? refusalWords(codeOf(error));
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function DeskSection() {
  const current = useQuery(api.desk.allotment, {});
  const allot = useMutation(api.desk.allot);
  const [coins, setCoins] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // The box starts at the amount now in force.
  useEffect(() => {
    if (current !== undefined) setCoins((c) => (c === "" ? String(current.monthlyCoins) : c));
  }, [current]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    try {
      const r = await allot({ monthlyCoins: Number(coins) });
      if (!r.ok) setError(wordFor(r.code));
      else setDone(`Every student now gets ${r.monthlyCoins} coins a month.`);
    } catch (err) {
      setError(wordFor(err));
    }
  }

  return (
    <div className="space-y-5" data-testid="desk-section">
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">Coins for the DHI desk</h2>
        {current === undefined ? (
          <p className="text-sm text-mute">Loading…</p>
        ) : (
          <p className="text-sm" data-testid="desk-allotment">
            Each student gets {current.monthlyCoins} coins a month
            {current.updatedAt === null
              ? " (the starting amount, nobody has changed it yet)."
              : `, set ${when(current.updatedAt)}.`}
          </p>
        )}
        {current !== undefined && (
          <p className="text-sm" data-testid="desk-today">
            Today {current.questionsToday} of {current.dailyCap} new questions have gone to the model,
            for all institutes together.
          </p>
        )}
        <p className="text-xs text-mute">
          A new question costs 1 coin, and a question asked before or a clarifying question costs
          none. Unused coins carry over to the next month. A change counts from each student's next
          top up.
        </p>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Set the monthly coins</h2>
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label text="Coins each month">
            <TextInput
              data-testid="desk-coins-input"
              type="number"
              min={0}
              max={MAX_MONTHLY_COINS}
              step={1}
              value={coins}
              onChange={(e) => setCoins(e.target.value)}
              required
            />
          </Label>
          <div className="sm:col-span-2">
            <Button type="submit" data-testid="desk-coins-save">
              Save
            </Button>
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
    </div>
  );
}
