import { createFileRoute } from "@tanstack/react-router";
import { ConvexSession } from "@/components/dhi/convex-session";
import { JoinPage } from "@/components/dhi/join-page";
import { DoorSkeleton } from "@/components/dhi/ui/loading-screens";

// The Join step (spec house/0002): the one plain address staff share with the people they invite. It is signed in state only, so it is never
// rendered on the server.
export const Route = createFileRoute("/join")({
  ssr: false,
  pendingComponent: DoorSkeleton,
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ConvexSession>
      <JoinPage />
    </ConvexSession>
  ),
});
