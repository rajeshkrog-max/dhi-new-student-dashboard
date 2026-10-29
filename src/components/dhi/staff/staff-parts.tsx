import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import type { GenericId } from "convex/values";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import type { HouseRole } from "@/lib/entry";
import { cn } from "@/lib/utils";

export type InstituteId = GenericId<"institutes">;
export type ClassId = GenericId<"classes">;
export type MemberId = GenericId<"members">;
export type InviteId = GenericId<"invites">;

// Who is looking and which institute they are working in (spec house/0002). A DHI admin chooses an institute; an institute admin and a teacher
// work in their own, and the server decides which one from who they are, so `instituteId` stays undefined for them.
export type StaffScope = { role: HouseRole; instituteId: InstituteId | undefined; instituteName: string | null; needsInstitute: boolean };

const ScopeContext = createContext<StaffScope | null>(null);
export const ScopeProvider = ScopeContext.Provider;
export function useScope(): StaffScope {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error("useScope was used outside the staff area.");
  return scope;
}

// The 25 a page rule (AC-18): a list shows its first page and a button for the next one.
export function Pager({ status, onMore }: { status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"; onMore: () => void }) {
  if (status === "CanLoadMore" || status === "LoadingMore") {
    return (
      <div className="mt-3 flex justify-center">
        <Button variant="quiet" disabled={status === "LoadingMore"} onClick={onMore}>
          {status === "LoadingMore" ? "Loading…" : "Show more"}
        </Button>
      </div>
    );
  }
  return null;
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-control bg-white/60 px-4 py-6 text-center text-sm text-mute">{children}</p>;
}

// Said under a class picker when the institute has no class yet, so an empty list is never left unexplained.
export function NoClassYet({ status, count }: { status: string; count: number }) {
  if (status === "LoadingFirstPage" || count > 0) return null;
  return (
    <p className="text-xs text-mute touch:text-sm" data-testid="no-class-yet">
      No class yet. An institute admin adds classes under Classes.
    </p>
  );
}

// Said when a screen needs an institute and a DHI admin has not chosen one yet.
export function ChooseInstitute() {
  return (
    <Notice className="px-4 py-3 text-sm">Please choose an institute first. Open the Institutes screen and press Open on one.</Notice>
  );
}

const CONTROL = "h-11 w-full min-w-0 rounded-control border border-home/20 bg-white px-3 text-sm text-home placeholder:text-mute";

export function Label({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs text-ink/70 touch:text-sm">{text}</span>
      {children}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function SelectInput({ children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cn(CONTROL, "pr-8", props.className)}>
      {children}
    </select>
  );
}

// The words under a form when a call is refused or succeeds. A refusal is a danger notice and is announced; a success is a quiet note.
export function Outcome({ error, done }: { error: string; done: string }) {
  if (error) {
    return (
      <Notice tone="danger" role="alert" data-testid="staff-error" className="px-4 py-3 text-sm">
        {error}
      </Notice>
    );
  }
  if (done) {
    return (
      <Notice role="status" data-testid="staff-done" className="px-4 py-3 text-sm">
        {done}
      </Notice>
    );
  }
  return null;
}
