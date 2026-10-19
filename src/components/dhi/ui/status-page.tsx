import { useEffect, type ReactNode } from "react";
import { useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { Compass, TriangleAlert } from "lucide-react";
import { backToHouse } from "@/lib/entry";
import { Button, buttonClass } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { TopBar } from "@/components/dhi/ui/top-bar";

// The words of every error and not found screen (spec house/0003, copy table). They are fixed on purpose: a student never sees a raw error.
const COPY = {
  notFound: { title: "This page is not here", words: "The address may be wrong, or the page may have moved." },
  error: { title: "Something went wrong", words: "We could not show this page. Please try again." },
  paused: { title: "This room paused", words: "Something went wrong in this room. Open it again." },
};

// A page that stands on its own: the brand top bar, then one card with a title, a few words and one or two buttons. It shows nothing about
// the student, because the page that failed may be the one that knows who they are.
export function StatusPage({ icon, title, words, children }: { icon: ReactNode; title: string; words: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-page text-home">
      <TopBar />
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center px-4 py-10">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-control bg-white text-home shadow-sm" aria-hidden>
            {icon}
          </span>
          <h1 className="mt-4 font-display text-2xl font-medium">{title}</h1>
          <p className="mt-2 text-sm text-mute touch:text-base">{words}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
        </Card>
      </div>
    </main>
  );
}

function BackToTheHouse({ variant }: { variant: "solid" | "quiet" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <a href={backToHouse(pathname)} className={buttonClass(variant)}>
      Back to the house
    </a>
  );
}

export function NotFoundPage() {
  return (
    <StatusPage icon={<Compass className="size-6" />} title={COPY.notFound.title} words={COPY.notFound.words}>
      <BackToTheHouse variant="solid" />
    </StatusPage>
  );
}

// The router's error screen. The thrown error goes to the console only. Try again resets the failed part and asks the router to load again,
// because invalidating alone does not clear a render error.
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage icon={<TriangleAlert className="size-6" />} title={COPY.error.title} words={COPY.error.words}>
      <Button
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
      <BackToTheHouse variant="quiet" />
    </StatusPage>
  );
}

// What a room shows when it fails inside the dashboard, in the room's own place so the menu stays.
export function PausedRoom({ onOpenAgain }: { onOpenAgain: () => void }) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-2xl">{COPY.paused.title}</h2>
      <p className="mt-2 text-sm text-mute">{COPY.paused.words}</p>
      <Button className="mt-4" onClick={onOpenAgain}>
        Open again
      </Button>
    </Card>
  );
}
