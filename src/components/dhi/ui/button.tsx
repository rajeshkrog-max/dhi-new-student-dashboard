import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "gold" | "quiet" | "link";

const BASE = "inline-flex items-center justify-center gap-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
// The three pill buttons are 44 px on touch and 40 px from 1024 px (house/0001 tap targets). The link variant is a small text button inside a
// card that grows to a 44 px target on touch without moving its text.
const PILL = "h-10 touch:h-11 rounded-full px-5";

const VARIANT: Record<ButtonVariant, string> = {
  solid: `${PILL} bg-home text-paper hover:bg-home/90`,
  gold: `${PILL} bg-gold text-gold-ink hover:bg-gold/90`,
  quiet: `${PILL} border border-white/80 bg-white/70 text-home hover:bg-white`,
  link: "tap text-xs font-normal text-grove touch:-mr-2 touch:px-2",
};

// Quiet on a dark scene (the Enter screen at night) is glass instead of paper.
const QUIET_ON_DARK = "border-white/30 bg-white/10 text-paper hover:bg-white/20";

/** The class string of a button, for a link (`<a href>`) that should look like one. */
export function buttonClass(variant: ButtonVariant = "solid", { onDark = false, className }: { onDark?: boolean; className?: string } = {}) {
  return cn(BASE, VARIANT[variant], variant === "quiet" && onDark && QUIET_ON_DARK, className);
}

export function Button({
  variant = "solid",
  onDark,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; onDark?: boolean }) {
  return <button type={type} className={buttonClass(variant, { onDark, className })} {...props} />;
}
