import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  gold: "bg-gold/50 text-gold-ink",
  mint: "bg-mint/50 text-grove",
  lilac: "bg-lilac/40 text-home",
} as const;

export type ChipTone = keyof typeof TONE;

// A small pill label.
export function Chip({ tone, className, children }: { tone: ChipTone; className?: string; children: ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium touch:text-xs", TONE[tone], className)}>{children}</span>;
}

const STATE = {
  accept: { label: "Accept", tone: "gold" },
  marked: { label: "Seen", tone: "mint" },
  open: { label: "Open", tone: "lilac" },
} as const;

// The state of an exam row.
export function StateChip({ status }: { status: keyof typeof STATE }) {
  const { label, tone } = STATE[status];
  return <Chip tone={tone}>{label}</Chip>;
}
