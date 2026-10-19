import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The front door's scene: a full screen picture with the card on it. The Enter screen puts the day or night video here, and its loading screen
// puts the night poster here, so the card does not move when the real screen replaces the skeleton. The background colour is taken from the night
// poster, so the paper page never flashes light before the picture paints.
export function DoorScene({ media, children }: { media: ReactNode; children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden overflow-y-auto bg-scene text-paper">
      <div className="pointer-events-none absolute inset-0">
        {media}
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/35" />
      </div>
      <p className="absolute left-6 top-6 z-10 font-display text-xs tracking-[0.22em] drop-shadow-lg">DHI</p>
      {children}
    </main>
  );
}

// Where the card sits on the scene and how big it is. `day` is the paper glass, night is the dark glass at 70% so every line on it reads even
// when the video behind is pure white (spec house/0003, AC-3).
export function doorCardClass(day: boolean, className?: string) {
  return cn(
    "relative z-50 mx-auto my-16 w-[min(400px,calc(100vw-2rem))] rounded-panel border p-6 shadow-2xl backdrop-blur-2xl",
    "sm:absolute sm:right-[7vw] sm:top-1/2 sm:mx-0 sm:my-0 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:overflow-y-auto",
    day ? "border-white/80 bg-white/70 text-home" : "border-white/25 bg-night/70 text-paper",
    className,
  );
}
