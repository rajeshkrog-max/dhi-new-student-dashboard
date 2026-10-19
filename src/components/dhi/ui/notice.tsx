import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  info: "border border-white/80 bg-white/60 text-mute backdrop-blur-md",
  danger: "bg-peach text-ink",
} as const;

// A calm line of words. `info` is a quiet note, `danger` is a problem the student can act on (use role="alert" with it).
export function Notice({
  tone = "info",
  className,
  children,
  ...rest
}: {
  tone?: keyof typeof TONE;
  className?: string;
  children: ReactNode;
  role?: string;
  "data-testid"?: string;
}) {
  return (
    <p className={cn("rounded-control px-4 py-2 text-xs touch:text-sm", TONE[tone], className)} {...rest}>
      {children}
    </p>
  );
}
