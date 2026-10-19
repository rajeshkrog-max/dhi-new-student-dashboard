import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The glass card every page is built from: a paper white sheet over the page, with the house corner (spec house/0003).
export function Card({ className, ...props }: ComponentProps<"article">) {
  return <article className={cn("rounded-card border border-white/80 bg-white/70 p-5 backdrop-blur-xl", className)} {...props} />;
}

const STAT_TONE = {
  peach: "bg-peach/40",
  lilac: "bg-lilac/35",
  mint: "bg-mint/40",
  gold: "bg-gold/40",
  grove: "bg-mint/25",
} as const;

export type StatTone = keyof typeof STAT_TONE;

// A tinted number card on the home board.
export function StatCard({ title, value, note, tone }: { title: string; value: string; note: string; tone: StatTone }) {
  return (
    <article className={cn("h-full rounded-card border border-white/80 p-4 backdrop-blur-xl", STAT_TONE[tone])}>
      <p className="text-xs text-mute">{title}</p>
      <p className="font-display mt-1 text-2xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-grove">{note}</p>
    </article>
  );
}
