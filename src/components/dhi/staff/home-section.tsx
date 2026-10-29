// The staff home (house spec 0026): the first screen of a teacher, an institute admin and a DHI admin. Counts of what waits for them, each with a
// button to its page, never a student's name or room data. Live, on the screen's own clock to the minute.
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { STAFF_WORDS, STAFF_WORDS_APPROVED } from "@/lib/dhi/staff-words";

type Item = { key: string; count: number; text: string; tab: string };

function useMinute(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 60000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function StaffHomeSection({ onGo }: { onGo: (tab: string) => void }) {
  const now = useMinute();
  const todo = useQuery(api.staffHome.todo, { now });

  let items: Item[] = [];
  if (todo?.role === "teacher") {
    const w = STAFF_WORDS.teacher;
    items = [
      { key: "toMark", count: todo.toMark, text: w.toMark(todo.toMark), tab: "papers" },
      { key: "toConfirm", count: todo.toConfirm, text: w.toConfirm(todo.toConfirm), tab: "papers" },
      { key: "posts", count: todo.postsToReview, text: w.postsToReview(todo.postsToReview), tab: "papers" },
      { key: "comments", count: todo.commentsToReview, text: w.commentsToReview(todo.commentsToReview), tab: "papers" },
      { key: "closing", count: todo.closingSoon, text: w.closingSoon(todo.closingSoon), tab: "papers" },
    ];
  } else if (todo?.role === "institute_admin") {
    const w = STAFF_WORDS.admin;
    items = [
      { key: "parent", count: todo.parentWaiting, text: w.parentWaiting(todo.parentWaiting), tab: "parent" },
      { key: "invites", count: todo.invitesPending, text: w.invitesPending(todo.invitesPending), tab: "invites" },
      { key: "expiring", count: todo.invitesExpiring, text: w.invitesExpiring(todo.invitesExpiring), tab: "invites" },
      { key: "paused", count: todo.classesPaused, text: w.classesPaused(todo.classesPaused), tab: "classes" },
    ];
  } else if (todo?.role === "dhi_admin") {
    const w = STAFF_WORDS.dhi;
    items = [
      { key: "noAdmin", count: todo.institutesWithoutAdmin, text: w.institutesWithoutAdmin(todo.institutesWithoutAdmin), tab: "invites" },
      { key: "films", count: todo.filmsWaiting, text: w.filmsWaiting(todo.filmsWaiting), tab: "films" },
      { key: "dishes", count: todo.dishesWaiting, text: w.dishesWaiting(todo.dishesWaiting), tab: "foods" },
      { key: "counselors", count: todo.counselorInvitesPending, text: w.counselorInvitesPending(todo.counselorInvitesPending), tab: "counselors" },
      { key: "institutes", count: todo.institutesPaused, text: w.institutesPaused(todo.institutesPaused), tab: "institutes" },
      { key: "desk", count: todo.deskToday, text: w.deskToday(todo.deskToday), tab: "desk" },
    ];
  }
  // The desk count is information, not a task, so it never makes the home look busy on its own.
  const waiting = items.filter((i) => i.count > 0 && i.key !== "desk");

  return (
    <div className="space-y-4" data-testid="staff-home">
      {!STAFF_WORDS_APPROVED && <p className="text-xs text-mute">{STAFF_WORDS.draft}</p>}
      <Card className="space-y-3">
        <p className="text-sm text-mute">{STAFF_WORDS.homeIntro}</p>
        {todo === undefined ? (
          <p className="text-sm text-mute">{STAFF_WORDS.loading}</p>
        ) : (
          <>
            {waiting.length === 0 && <p className="text-sm" data-testid="staff-home-empty">{STAFF_WORDS.nothing}</p>}
            <ul className="space-y-2">
              {items
                .filter((i) => i.count > 0)
                .map((i) => (
                  <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-home/15 bg-white/70 px-3 py-2" data-testid={`todo-${i.key}`}>
                    <span className="text-sm">{i.text}</span>
                    <Button variant="quiet" onClick={() => onGo(i.tab)} aria-label={`${STAFF_WORDS.open}: ${i.text}`}>
                      {STAFF_WORDS.open}
                    </Button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
