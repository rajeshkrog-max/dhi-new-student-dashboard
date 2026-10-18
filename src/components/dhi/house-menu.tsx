import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type HouseRoom = { id: string; label: string; icon: LucideIcon };

// The 11 rooms, Leave and the exam lock. Rendered in the side menu (from 1024) and in the drawer
// (below 1024) so both read the same list and the same locked state.
export function HouseMenu({
  rooms,
  tab,
  locked,
  variant,
  onPick,
  onLeave,
}: {
  rooms: HouseRoom[];
  tab: string;
  locked: boolean;
  variant: "side" | "drawer";
  onPick: (id: string) => void;
  onLeave: () => void;
}) {
  const drawer = variant === "drawer";
  return (
    <>
      <nav
        className={cn("flex flex-col gap-0.5", !drawer && "min-h-0 flex-1 overflow-y-auto")}
        aria-label="Student rooms"
      >
        {rooms.map((item) => {
          const Icon = item.icon;
          const on = tab === item.id;
          const freeze = locked && item.id !== "papers";
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                disabled={freeze}
                data-room={item.id}
                onClick={() => onPick(item.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 text-left text-sm",
                  drawer ? "h-11" : "h-10 touch:h-11",
                  on ? "bg-white shadow-sm" : !freeze && "hover:bg-white/40",
                  freeze && "opacity-40",
                )}
              >
                <Icon className="size-4 opacity-70" aria-hidden />
                {item.label}
              </button>
              {freeze && !drawer && <ExamTip />}
            </div>
          );
        })}
      </nav>
      <div className={cn("group relative", drawer ? "mt-2" : "mt-3")}>
        <button
          type="button"
          data-testid="leave"
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-3 text-sm text-mute hover:bg-white/40 disabled:opacity-40",
            "h-11",
          )}
          disabled={locked}
          onClick={onLeave}
        >
          <LogOut className="size-4" aria-hidden />
          Leave
        </button>
        {locked && !drawer && <ExamTip />}
      </div>
      {locked && drawer && (
        <p role="status" className="mt-2 rounded-2xl bg-home px-4 py-2.5 text-sm text-paper">
          Exam is going on
        </p>
      )}
    </>
  );
}

// The hover tip the side menu has always had. Touch screens get the visible line in the drawer.
function ExamTip() {
  return (
    <>
      <span className="absolute inset-0 z-10 cursor-not-allowed" title="Exam is going on" />
      <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 hidden -translate-y-1/2 rounded-xl bg-home px-3 py-1.5 text-xs text-paper shadow-lg group-hover:block">
        Exam is going on
      </span>
    </>
  );
}
