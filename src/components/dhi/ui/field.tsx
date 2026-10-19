import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// A labelled box for one input, with an optional icon before it. `onDark` is the Enter screen at night. The box shows the focus ring when its
// input has keyboard focus (the input itself marks data-in-field, see styles.css).
export function Field({ label, onDark, children }: { label: string; onDark?: boolean; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className={cn("mb-2 block text-xs", onDark ? "text-paper/85" : "text-ink/70")}>{label}</span>
      <span
        className={cn(
          "flex h-12 items-center gap-2 rounded-control border px-3 has-[:focus-visible]:focus-ring",
          onDark ? "border-white/30 bg-night/50" : "border-white/80 bg-white/60",
        )}
      >
        {children}
      </span>
    </label>
  );
}

export function FieldInput({ className, ...props }: ComponentProps<"input">) {
  return <input data-in-field className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-70", className)} {...props} />;
}
