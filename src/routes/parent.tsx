import { createFileRoute } from "@tanstack/react-router";
import { ParentPage } from "@/components/dhi/parent-page";

// The weekly parent page (house spec 0022). No sign in and no Convex session: the code after the `#` is the whole key, so this route never renders
// on the server and sends no referrer. It is not indexed.
export const Route = createFileRoute("/parent")({
  ssr: false,
  head: () => ({
    meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: ParentPage,
});
