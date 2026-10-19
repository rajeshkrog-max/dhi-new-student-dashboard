import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/dhi/ui/brand-mark";

// The brand top bar. On the dashboard it shows below 1024 px (the side menu takes over from there) with the menu button and the bell at its
// ends; on the status pages and the loading screens it shows at every width with nothing at the ends.
export function TopBar({ start, end, belowLargeOnly, className }: { start?: ReactNode; end?: ReactNode; belowLargeOnly?: boolean; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/70 bg-page/85 px-3 backdrop-blur-xl",
        belowLargeOnly && "lg:hidden",
        className,
      )}
    >
      {start ?? <span className="size-11" aria-hidden />}
      <BrandMark />
      {end ?? <span className="size-11" aria-hidden />}
    </header>
  );
}
