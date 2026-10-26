// The DHI score card on the home screen (spec house/0017). It shows the student's own score with the three lamps and the inputs behind each, and how many
// days they logged mood and meals (presence only). The score is a growth mark from the student's own last four weeks: it is never a rank and never
// compared with another student. The card is drawn at its full size before the numbers arrive (the lamp names, what each lamp is made of, and a
// placeholder for each value), so nothing on the page moves when the numbers come in (spec house/0003, AC-5).
import { useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Card } from "@/components/dhi/ui/card";

// What the card shows while it waits. The same words come back from the server with the values.
const WAITING = [
  { name: "Sadhana", inputs: ["Papers sat before the window closed", "Days sat in the study hour, of the days one was open"] },
  { name: "Niyam", inputs: ["Days with a habit tick, of the days one was open"] },
  { name: "Viveka", inputs: ["Films kept, out of four in four weeks"] },
];

export function HomeScore() {
  const home = useQuery(api.home.summary, {});
  const lamps = home
    ? home.lamps
    : WAITING.map((l) => ({ name: l.name, value: null as number | null, inputs: l.inputs.map((label) => ({ label, value: "…" })) }));
  return (
    <Card className="space-y-4" data-testid="home-score" aria-busy={home === undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Your DHI score</h3>
        <span className="font-display text-3xl" data-testid="score-value">
          {home === undefined ? "…" : home.score === null ? "Not yet" : home.score}
        </span>
      </div>
      <p className="text-xs text-mute">
        A growth mark from your own last four weeks. It compares you only with yourself, and it is never a rank. Each lamp that has something to measure counts the same.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {lamps.map((l) => (
          <div key={l.name} className="rounded-control border border-home/15 bg-white/70 p-3" data-testid={`lamp-${l.name.toLowerCase()}`}>
            <p className="text-sm font-medium">
              {l.name} {l.value === null ? "" : `· ${Math.round(l.value * 100)}%`}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-mute">
              {l.inputs.map((i) => (
                <li key={i.label}>
                  {i.label}: {i.value}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-mute">
        {home === undefined
          ? "Days you logged a mood and days you logged a meal show here. They show presence only; what you wrote is not part of the score."
          : `Days you logged a mood: ${home.presence.moodDays}. Days you logged a meal: ${home.presence.mealDays}. These show presence only; what you wrote is not part of the score.`}
      </p>
    </Card>
  );
}
