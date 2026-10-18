import type { ComponentProps, ReactNode } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth/client";

// The one place the house connects to the shared Convex deployment and the shared sign in (spec 0003, spec 0008). Signed in state is read
// in the browser only, so the routes that use this one never render on the server (`ssr: false`), and the demo rooms are not wrapped.
let convex: ConvexReactClient | null = null;
function convexClient(): ConvexReactClient {
  // `unsavedChangesWarning` is off: the house saves nothing from here yet, and a leave prompt would only worry a student for nothing.
  convex ??= new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL as string, { unsavedChangesWarning: false });
  return convex;
}

// The integration's `AuthClient` type wrongly narrows `useSession().data` to `never` for a client built with only the Convex plugin
// (same on TypeScript 5.9 and 7). The client has everything the provider calls at runtime, so it is cast here, once.
type ProviderAuthClient = ComponentProps<typeof ConvexBetterAuthProvider>["authClient"];

export function ConvexSession({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convexClient()} authClient={authClient as unknown as ProviderAuthClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}

// Neutral: it says nothing about being signed in or out, and shows nothing about any student.
export function Waiting() {
  return (
    <main className="grid min-h-dvh place-items-center bg-home-bg px-4 text-home" data-testid="entry-waiting">
      <p role="status" className="text-sm">
        One moment…
      </p>
    </main>
  );
}
