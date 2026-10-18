import { createFileRoute } from "@tanstack/react-router";
import { ConvexSession } from "@/components/dhi/convex-session";
import { FrontDoor } from "@/components/dhi/front-door";
import { referralParam } from "@/lib/entry";

// The front door under its own address (spec 0008): Google comes back here, and so does a failed Google sign in (`signin=error`). The root
// address `/` shows the same door.
export const Route = createFileRoute("/enter")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { signin?: "error"; ref?: string } => ({
    ...(search.signin === "error" ? { signin: "error" as const } : {}),
    ...(referralParam(search.ref) ? { ref: referralParam(search.ref) } : {}),
  }),
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: EnterRoute,
});

function EnterRoute() {
  const { signin, ref } = Route.useSearch();
  return (
    <ConvexSession>
      <FrontDoor signInFailed={signin === "error"} referral={ref} />
    </ConvexSession>
  );
}
