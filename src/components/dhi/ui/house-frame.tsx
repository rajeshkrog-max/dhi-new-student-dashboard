import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The dashboard's frame: the page wash, the top bar below 1024 px, the side menu from 1024 px, and the scrolling column. The live dashboard and
// its loading screen both draw it, so the screen that replaces the skeleton does not move anything (spec house/0003, AC-5).
export function HouseFrame({
  topBar,
  side,
  children,
  sectionClassName,
  testId,
}: {
  topBar: ReactNode;
  side: ReactNode;
  children: ReactNode;
  sectionClassName?: string;
  testId?: string;
}) {
  return (
    <div className="min-h-dvh bg-page text-home lg:h-dvh lg:overflow-hidden" data-testid={testId}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_500px_at_8%_-8%,var(--color-wash-lilac)_0%,transparent_50%),radial-gradient(700px_420px_at_100%_0%,var(--color-wash-peach)_0%,transparent_46%)]" />
      {topBar}
      <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-3 p-3 lg:h-full lg:grid-cols-[220px_1fr] lg:gap-5 lg:overflow-hidden lg:p-5">
        <aside
          className="hidden min-h-0 flex-col rounded-panel border border-white/70 bg-gradient-to-b from-wash-menu/80 to-white/50 p-4 backdrop-blur-xl lg:flex lg:overflow-y-auto"
          aria-label="House menu"
        >
          {side}
        </aside>
        <section
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:h-full lg:pr-1",
            sectionClassName,
          )}
          aria-label="House"
        >
          {children}
        </section>
      </div>
    </div>
  );
}
