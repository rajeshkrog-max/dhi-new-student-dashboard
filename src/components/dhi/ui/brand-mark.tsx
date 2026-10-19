import { cn } from "@/lib/utils";

// The DHI mark: the star tile and the wordmark. One markup for the top bar, the side menu, the drawer and the status pages.
export function BrandMark({ size = "bar", className }: { size?: "bar" | "menu"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-display text-sm tracking-[0.16em]", className)}>
      <span className={cn("grid place-items-center rounded-chip bg-white shadow-sm", size === "menu" ? "size-9" : "size-8")} aria-hidden>
        ✦
      </span>
      DHI
    </span>
  );
}
