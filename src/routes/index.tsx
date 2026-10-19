import { createFileRoute } from "@tanstack/react-router";
import { ConvexSession } from "@/components/dhi/convex-session";
import { FrontDoor } from "@/components/dhi/front-door";
import { DoorSkeleton } from "@/components/dhi/ui/loading-screens";
import { referralParam } from "@/lib/entry";

// The main address (spec 0008). It is the front door: a signed in student with a finished interview lands on the dashboard, a new or
// unfinished one on the interview, a friend with a referral code (`/?ref=ABC1234`) on the interview with the code kept, and anyone else
// sees the Enter screen. The old demo house that used to open here is gone from this address.
export const Route = createFileRoute("/")({
  ssr: false,
  pendingComponent: DoorSkeleton,
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    const ref = referralParam(search.ref);
    return ref ? { ref } : {};
  },
  head: () => ({ meta: [{ title: "DHI" }] }),
  component: RootRoute,
});

function RootRoute() {
  const { ref } = Route.useSearch();
  return (
    <ConvexSession>
      <FrontDoor signInFailed={false} referral={ref} />
    </ConvexSession>
  );
}
