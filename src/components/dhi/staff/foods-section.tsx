// The food table, for a DHI admin (spec house/0009). The custom dishes students added are listed by name only, with no owner. Publishing one
// copies it into the shared catalog with the source "DHI checked", so everyone's search finds it.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

export function FoodsSection() {
  const dishes = useQuery(api.foods.unpublished, {});
  const publish = useMutation(api.foods.publish);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function act(foodId: GenericId<"foods">, name: string) {
    setError("");
    setDone("");
    try {
      await publish({ foodId });
      setDone(`${name} is now in the shared catalog.`);
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <Card className="space-y-3" data-testid="foods-section">
      <h2 className="text-sm font-semibold">Dishes students added</h2>
      <p className="text-xs text-mute">Publishing copies a dish into the shared catalog. Students never see who added it.</p>
      {dishes === undefined && <p className="text-sm text-mute">Loading…</p>}
      {dishes?.length === 0 && <p className="text-sm text-mute">No dishes are waiting.</p>}
      {dishes?.map((d) => (
        <div key={d.foodId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {d.nameEn} · {d.group} · {d.processing}
          </span>
          <Button variant="quiet" onClick={() => act(d.foodId, d.nameEn)}>
            Publish
          </Button>
        </div>
      ))}
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
    </Card>
  );
}
