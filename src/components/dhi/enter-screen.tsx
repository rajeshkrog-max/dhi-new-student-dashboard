import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Moon, Sun, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { signInWithGoogle, testSignIn, testSignInOffered } from "@/lib/auth/client";
import { ENTER_PATH } from "@/lib/entry";
import { cn } from "@/lib/utils";

type Pane = "signin" | "invite";

// The front door's sign in screen (spec 0008). Google comes back to `/enter`, which then decides between the interview and the dashboard;
// a failed Google sign in comes back there too, with `signin=error`, so its message is shown by the same screen.
const AFTER_SIGN_IN = ENTER_PATH;
const AFTER_SIGN_IN_ERROR = `${ENTER_PATH}?signin=error`;

export function EnterScreen({
  onSignedIn,
  onDemo,
  notice,
}: {
  onSignedIn: () => void;
  onDemo?: () => void;
  notice?: string;
}) {
  const [day, setDay] = useState(false);
  const [pane, setPane] = useState<Pane>("signin");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("day", day);
  }, [day]);

  async function google() {
    setError("");
    const { ok } = await signInWithGoogle(AFTER_SIGN_IN, AFTER_SIGN_IN_ERROR);
    if (!ok) setError("Google sign in could not start. Please try again.");
  }

  async function testForm(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { ok } = await testSignIn(email.trim(), password);
    setBusy(false);
    if (ok) onSignedIn();
    else setError("The test sign in did not work. Please check the email and password (8 letters or more).");
  }

  const message = error || notice || "";
  const muted = day ? "text-ink/70" : "text-paper/70";
  const tab = (active: boolean) =>
    cn(
      "h-11 rounded-full border text-sm",
      active
        ? day
          ? "border-white/70 bg-white/70"
          : "border-white/30 bg-white/20"
        : day
          ? "border-ink/15 bg-white/25"
          : "border-white/20 bg-white/5",
    );

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
        data-testid="landing-signin"
        className={cn(
          "relative z-50 mx-auto my-16 w-[min(400px,calc(100vw-2rem))] rounded-[28px] border p-6 shadow-2xl backdrop-blur-2xl sm:absolute sm:right-[7vw] sm:top-1/2 sm:mx-0 sm:my-0 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:overflow-y-auto",
          day ? "border-white/50 bg-white/30 text-ink" : "border-white/25 bg-[#101218]/35 text-paper",
        )}
      >
        <h1 className="font-display text-4xl font-medium">Enter</h1>
        <p className={cn("mt-1.5 text-sm", muted)}>
          {pane === "signin" ? "Welcome back. Your house is waiting." : "Invite letters are not open yet."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPane("signin")} className={tab(pane === "signin")}>
            I have a seat
          </button>
          <button type="button" onClick={() => setPane("invite")} className={tab(pane === "invite")}>
            Invite letter
          </button>
        </div>

        {message ? (
          <p role="alert" data-testid="landing-error" className="mt-4 text-xs text-[#f7c9c0]">
            {message}
          </p>
        ) : null}

        {pane === "invite" ? (
          <p className={cn("mt-5 text-sm leading-relaxed", muted)}>
            If you already have a seat, choose I have a seat and sign in with Google.
          </p>
        ) : (
          <>
            <button
              type="button"
              data-testid="landing-google"
              onClick={google}
              className={cn("mt-5 h-12 w-full rounded-2xl text-sm font-medium", day ? "bg-grove text-paper" : "bg-gold text-gold-ink")}
            >
              Continue with Google
            </button>

            {testSignInOffered && (
              <form className="mt-2" onSubmit={testForm} data-testid="landing-test-form">
                <p className={cn("mt-5 text-center text-[10px] tracking-[0.12em] uppercase", muted)}>Test sign in (this build only)</p>
                <Field label="Email">
                  <Mail className="size-4 opacity-60" />
                  <input
                    data-testid="landing-email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="you@institute.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
                  />
                </Field>

                <Field label="Password">
                  <Lock className="size-4 opacity-60" />
                  <input
                    data-testid="landing-password"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="off"
                    placeholder="8 letters or more"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="opacity-70 touch:-mr-2 touch:grid touch:size-11 touch:place-items-center"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </Field>

                <button
                  type="submit"
                  data-testid="landing-submit"
                  disabled={busy}
                  className={cn(
                    "mt-4 h-12 w-full rounded-2xl border text-sm font-medium disabled:opacity-50",
                    day ? "border-ink/25 bg-white/40" : "border-white/30 bg-white/10",
                  )}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}
          </>
        )}

        {onDemo && (
          <p className={cn("mt-5 text-center text-xs leading-relaxed", day ? "text-ink/60" : "text-paper/60")}>
            <button type="button" data-testid="landing-demo" onClick={onDemo} className="underline underline-offset-4">
              Look around the demo house
            </button>
          </p>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-[10px] tracking-[0.12em] uppercase opacity-60 touch:text-xs">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3">{children}</span>
    </label>
  );
}
