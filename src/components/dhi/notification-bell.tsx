// The bell at the top of the house (spec house/0017). It shows what is waiting for the signed in student, read from their own rows when they look:
// a paper that is open now, a mark that is ready to read, a feeling card from a study hour. The dot shows only while something is waiting. Opening the
// bell lists those things, each with a way into its room. Nothing is counted about other students and nothing is stored.
import { useState } from "react";
import { useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { api } from "@dhi/backend/api";
import { Sheet } from "@/components/dhi/sheet";
import { Button } from "@/components/dhi/ui/button";
import { cn } from "@/lib/utils";

const SENTENCE: Record<string, (title: string) => string> = {
  exam_open: (title) => `${title} is open now.`,
  mark: (title) => `Your mark for ${title} is ready to read.`,
  feeling: () => "How did your last study hour feel? One tap, or skip.",
};
const ROOM_NAME: Record<string, string> = { papers: "Exams", hour: "Study hour" };

export function NotificationBell({ className, onOpen }: { className?: string; onOpen: (room: string) => void }) {
  const items = useQuery(api.waiting.mine, {});
  const [open, setOpen] = useState(false);
  const count = items?.length ?? 0;
  return (
    <>
      <button
        type="button"
        data-testid="bell"
        aria-label={count > 0 ? `Notifications, ${count} waiting` : "Notifications, nothing waiting"}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("relative grid size-11 place-items-center rounded-control border border-white/80 bg-white/70 backdrop-blur-md", className)}
      >
        <Bell className="size-4" aria-hidden />
        {count > 0 && <span data-decorative data-testid="bell-dot" className="absolute right-2 top-2 size-2 rounded-full bg-peach" />}
      </button>
      <Sheet open={open} onOpenChange={setOpen} side="right" title="Waiting for you">
        {items === undefined ? (
          <p className="text-sm text-mute">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-mute" data-testid="bell-empty">
            Nothing is waiting for you.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="bell-list">
            {items.map((item, i) => (
              <li key={`${item.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-home/15 bg-white/70 p-3 text-sm">
                <span>{(SENTENCE[item.kind] ?? (() => item.title))(item.title)}</span>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setOpen(false);
                    onOpen(item.room);
                  }}
                >
                  Open {ROOM_NAME[item.room] ?? item.room}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
