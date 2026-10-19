import { useState, type FormEvent } from "react";
import { Moon, Sun, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { signInWithGoogle, testSignIn, testSignInOffered } from "@/lib/auth/client";
import { ENTER_PATH } from "@/lib/entry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/dhi/ui/button";
import { DoorScene, doorCardClass } from "@/components/dhi/ui/door";
import { Field, FieldInput } from "@/components/dhi/ui/field";
import { Notice } from "@/components/dhi/ui/notice";

type Pane = "signin" | "invite";

// The front door's sign in screen (spec 0008). Google comes back to `/enter`, which then decides between the interview and the dashboard;
// a failed Google sign in comes back there too, with `signin=error`, so its message is shown by the same screen.
const AFTER_SIGN_IN = ENTER_PATH;
const AFTER_SIGN_IN_ERROR = `${ENTER_PATH}?signin=error`;

// The card, buttons and fields come from the shared kit (spec house/0003), so the door reads as the dashboard's look on a scene. Day is the paper
// glass; night is the dark glass at 70%, so every line on it stays readable even over the brightest frame of the video.
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
  const muted = day ? "text-home/80" : "text-paper/85";
  // The chosen tab is a solid pill in the opposite tone, so it reads over any frame of the video.
  const tab = (active: boolean) =>
    active ? (day ? "border-home bg-home text-paper hover:bg-home" : "border-paper bg-paper text-home hover:bg-paper") : "";

  return (
    <DoorScene
      media={
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
      }
    >
      <button
        type="button"
        aria-label={day ? "Switch to night" : "Switch to day"}
        onClick={() => setDay((v) => !v)}
        className="absolute right-5 top-5 z-10 flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/15 text-paper backdrop-blur-md"
      >
        {day ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      </button>

      <section data-testid="landing-signin" className={doorCardClass(day)}>
        <h1 className="font-display text-4xl font-medium">Enter</h1>
        <p className={cn("mt-1.5 text-sm", muted)}>
          {pane === "signin" ? "Welcome back. Your house is waiting." : "Invite letters are not open yet."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="quiet" onDark={!day} aria-pressed={pane === "signin"} className={cn("px-2", tab(pane === "signin"))} onClick={() => setPane("signin")}>
            I have a seat
          </Button>
          <Button variant="quiet" onDark={!day} aria-pressed={pane === "invite"} className={cn("px-2", tab(pane === "invite"))} onClick={() => setPane("invite")}>
            Invite letter
          </Button>
        </div>

        {message ? (
          <Notice tone="danger" role="alert" data-testid="landing-error" className="mt-4">
            {message}
          </Notice>
        ) : null}

        {pane === "invite" ? (
          <p className={cn("mt-5 text-sm leading-relaxed", muted)}>
            If you already have a seat, choose I have a seat and sign in with Google.
          </p>
        ) : (
          <>
            <Button variant={day ? "solid" : "gold"} data-testid="landing-google" onClick={google} className="mt-5 w-full">
              Continue with Google
            </Button>

            {testSignInOffered && (
              <form className="mt-2" onSubmit={testForm} data-testid="landing-test-form">
                <p className={cn("mt-5 text-center text-xs tracking-[0.12em] uppercase", muted)}>Test sign in (this build only)</p>
                <Field label="Email" onDark={!day}>
                  <Mail className="size-4 opacity-70" aria-hidden />
                  <FieldInput
                    data-testid="landing-email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="you@institute.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field label="Password" onDark={!day}>
                  <Lock className="size-4 opacity-70" aria-hidden />
                  <FieldInput
                    data-testid="landing-password"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="off"
                    placeholder="8 letters or more"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="rounded-full opacity-80 touch:-mr-2 touch:grid touch:size-11 touch:place-items-center"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </Field>

                <Button type="submit" variant="quiet" onDark={!day} data-testid="landing-submit" disabled={busy} className="mt-4 w-full">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            )}
          </>
        )}

        {onDemo && (
          <p className={cn("mt-5 text-center text-xs leading-relaxed", muted)}>
            <button type="button" data-testid="landing-demo" onClick={onDemo} className="tap underline underline-offset-4">
              Look around the demo house
            </button>
          </p>
        )}
      </section>
    </DoorScene>
  );
}
