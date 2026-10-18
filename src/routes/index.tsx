import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EnterScreen } from "@/components/dhi/enter-screen";
import { StudentHome } from "@/routes/home";
import { useGate } from "@/lib/dhi/gate";

export const Route = createFileRoute("/")({ component: Landing });

// The old demo front page. A real sign in hands over to `/enter`, which sends the student to the interview or the dashboard (spec 0008).
function Landing() {
  const { inHouse, enter } = useGate();
  const navigate = useNavigate();

  if (inHouse) return <StudentHome />;
  return <EnterScreen onSignedIn={() => void navigate({ to: "/enter" })} onDemo={() => enter()} />;
}
