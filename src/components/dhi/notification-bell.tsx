import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

// No unread count exists yet, so the dot is always shown, as before.
export function NotificationBell({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Notifications"
      className={cn(
        "relative grid size-11 place-items-center rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md",
        className,
      )}
    >
      <Bell className="size-4" aria-hidden />
      <span data-decorative className="absolute right-2 top-2 size-2 rounded-full bg-peach" />
    </span>
  );
}
