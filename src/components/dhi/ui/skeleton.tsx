import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

// How long a loading screen stays quiet before it adds the calm line and Try again (spec house/0003, AC-6).
export const SLOW_WAIT_MS = 8000;
// A skeleton that unmounts and mounts again inside this time (a redirect, a swap to the next skeleton) is the same wait, not a new one.
const SAME_WAIT_MS = 1500;

// A muted block that stands in for text, a picture or a card. It pulses slowly, and not at all for a student who asks for less motion.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-chip bg-home/10 motion-safe:animate-[skeleton-pulse_var(--duration-pulse)_ease-in-out_infinite]", className)}
    />
  );
}

// What a screen reader hears while a skeleton shows. Every loading screen has exactly one of these.
export function LoadingStatus() {
  return (
    <p role="status" className="sr-only">
      Loading
    </p>
  );
}

// A card shaped like a card with a title and a few lines, for data that arrives later.
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card aria-busy className={className}>
      <LoadingStatus />
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </Card>
  );
}

const waits = new Map<string, { start: number; lastSeen: number }>();

/**
 * True once a wait has run past `SLOW_WAIT_MS`. The clock is kept per key (the route's address), not per component, so a skeleton that remounts
 * does not restart it. It returns to false when the skeleton goes away.
 */
export function useSlowWait(key: string, ms: number = SLOW_WAIT_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const now = Date.now();
    const known = waits.get(key);
    const start = known && now - known.lastSeen < SAME_WAIT_MS ? known.start : now;
    waits.set(key, { start, lastSeen: now });
    const left = ms - (now - start);
    const timer = setTimeout(() => setSlow(true), Math.max(left, 0));
    return () => {
      clearTimeout(timer);
      const wait = waits.get(key);
      if (wait) wait.lastSeen = Date.now();
    };
  }, [key, ms]);
  return slow;
}

// After the slow time, one calm line and a way out sit over the loading screen. The screen keeps its shape and nothing under it moves.
export function SlowWait() {
  const key = useRouterState({ select: (s) => s.location.pathname });
  const slow = useSlowWait(key);
  if (!slow) return null;
  return (
    <div className="fixed inset-x-3 bottom-6 z-40 mx-auto flex max-w-md items-center gap-3 rounded-card border border-white/80 bg-page p-2 pl-3 shadow-lg">
      <Notice role="status" className="min-w-0 flex-1 border-0 bg-transparent p-0">
        This is taking longer than usual.
      </Notice>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
