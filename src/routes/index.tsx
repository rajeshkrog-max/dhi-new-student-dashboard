import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Moon, Sun, Mail, Lock, KeyRound, Eye, EyeOff } from "lucide-react";
import { StudentHome } from "@/routes/home";
import { useGate } from "@/lib/dhi/gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Landing });

type Pane = "signin" | "invite";

function Landing() {
  const { inHouse, enter } = useGate();
  const [day, setDay] = useState(false);
  const [pane, setPane] = useState<Pane>("signin");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("suzzy@dhi.house");
  const [password, setPassword] = useState("dhi");
  const [code, setCode] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("day", day);
  }, [day]);

  function openHouse(e?: FormEvent | MouseEvent) {
    e?.preventDefault();
    setError("");
    try {
      enter(email || "suzzy@dhi.house");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the house.");
    }
  }

  if (inHouse) return <StudentHome />;

  return (
    <main className="relative min-h-dvh overflow-x-hidden overflow-y-auto text-paper">
      <div className="pointer-events-none absolute inset-0">
        <video
          key={day ? "day" : "night"}
          className="absolute inset-0 size-full object-cover object-[20%_40%]"
          autoPlay
          muted
          loop
          playsInline
          poster={day ? "/landing/day.png" : "/landing/night.png"}
        >
          <source src={day ? "/landing/day.mp4" : "/landing/night.mp4"} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/35" />
      </div>

      <p className="absolute left-6 top-6 z-10 font-display text-xs tracking-[0.22em] drop-shadow-lg">DHI</p>

      <button
        type="button"
        aria-label={day ? "Switch to night" : "Switch to day"}
        onClick={() => setDay((v) => !v)}
        className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/15 text-paper backdrop-blur-md"
      >
        {day ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <section
        className={cn(
          "relative z-50 mx-auto my-16 w-[min(400px,calc(100vw-2rem))] rounded-[28px] border p-6 shadow-2xl backdrop-blur-2xl sm:absolute sm:right-[7vw] sm:top-1/2 sm:mx-0 sm:my-0 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:overflow-y-auto",
          day ? "border-white/50 bg-white/30 text-ink" : "border-white/25 bg-[#101218]/35 text-paper",
        )}
      >
        <h1 className="font-display text-4xl font-medium">Enter</h1>
        <p className={cn("mt-1.5 text-sm", day ? "text-ink/70" : "text-paper/70")}>
          {pane === "signin" ? "Welcome back. Your house is waiting." : "Enter the email and code from our letter."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPane("signin")}
            className={cn(
              "h-11 rounded-full border text-sm",
              pane === "signin"
                ? day
                  ? "border-white/70 bg-white/70"
                  : "border-white/30 bg-white/20"
                : day
                  ? "border-ink/15 bg-white/25"
                  : "border-white/20 bg-white/5",
            )}
          >
            I have a seat
          </button>
          <button
            type="button"
            onClick={() => setPane("invite")}
            className={cn(
              "h-11 rounded-full border text-sm",
              pane === "invite"
                ? day
                  ? "border-white/70 bg-white/70"
                  : "border-white/30 bg-white/20"
                : day
                  ? "border-ink/15 bg-white/25"
                  : "border-white/20 bg-white/5",
            )}
          >
            Invite letter
          </button>
        </div>

        <form className="mt-2" onSubmit={openHouse} noValidate>
          <Field label="Email">
            <Mail className="size-4 opacity-60" />
            <input
              type="text"
              autoComplete="username"
              placeholder="you@institute.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
            />
          </Field>

          {pane === "invite" && (
            <Field label="Invite code">
              <KeyRound className="size-4 opacity-60" />
              <input
                type="text"
                placeholder="DHI-••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-w-0 flex-1 bg-transparent uppercase outline-none placeholder:opacity-40"
              />
            </Field>
          )}

          <Field label={pane === "invite" ? "Set password" : "Password"}>
            <Lock className="size-4 opacity-60" />
            <input
              type={showPw ? "text" : "password"}
              autoComplete={pane === "invite" ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="opacity-70" aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </Field>

          {error ? <p className="mt-3 text-xs text-[#f7c9c0]">{error}</p> : null}

          <div className={cn("mt-4 mb-5 flex items-center justify-between text-xs", day ? "text-ink/70" : "text-paper/70")}>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-gold" defaultChecked />
              Remember me
            </label>
            {pane === "signin" ? <span>Forgot password?</span> : <span>I accept the house notice</span>}
          </div>

          <button
            type="button"
            onClick={openHouse}
            className={cn("h-12 w-full rounded-2xl text-sm font-medium", day ? "bg-grove text-paper" : "bg-gold text-gold-ink")}
          >
            Sign in
          </button>
        </form>

        <p className={cn("mt-4 text-center text-xs leading-relaxed", day ? "text-ink/60" : "text-paper/60")}>
          Demo seat is filled. Press the gold Sign in. Any email works.
        </p>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-[10px] tracking-[0.12em] uppercase opacity-60">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3">{children}</span>
    </label>
  );
}
