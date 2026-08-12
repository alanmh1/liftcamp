import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoAsset from "@/assets/replog-logo.svg.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — LiftCamp" },
      {
        name: "description",
        content: "Track your lifts, spot PRs, and know what to do next.",
      },
      { property: "og:title", content: "Sign in — LiftCamp" },
      {
        property: "og:description",
        content: "Track your lifts, spot PRs, and know what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://liftcamp.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.lovable.app/login" }],
  }),
  component: LoginPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [forgotSent, setForgotSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [session, loading, navigate]);

  async function signInWithGoogle() {
    setError(null);
    setGoogleBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleBusy(false);
      setError("Couldn't sign in with Google. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setForgotSent(true);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const showForm = !(mode === "forgot" && forgotSent) && !confirmSent;

  return (
    <div className="min-h-dvh flex flex-col bg-background px-6 pt-12 pb-10 sm:justify-center">
      <div className="w-full max-w-sm mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="" className="h-11 w-11" />
          <h1 className="font-display text-3xl">LiftCamp</h1>
        </Link>
        <p className="mt-3 text-base text-foreground/80">
          Track your lifts, spot PRs, and know what to do next.
        </p>

        {mode !== "forgot" && (
          <div
            role="tablist"
            aria-label="Account"
            className="mt-7 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
          >
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setConfirmSent(false);
                }}
                className={cn(
                  "h-10 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        {showForm && mode !== "forgot" && (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleBusy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-input bg-card text-sm font-semibold transition-colors hover:bg-accent/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GoogleMark />
              {googleBusy ? "Opening Google…" : "Continue with Google"}
            </button>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="micro text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {mode === "forgot" && !forgotSent && (
          <p className="mt-6 text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>
        )}

        {confirmSent ? (
          <div className="mt-8 rounded-lg border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm font-semibold">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a confirmation link to {email}.
            </p>
          </div>
        ) : mode === "forgot" && forgotSent ? (
          <div className="mt-8 rounded-lg border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm font-semibold">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a password reset link to {email}.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-3 pr-12 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                }}
                className="block text-sm text-muted-foreground underline"
              >
                Forgot password?
              </button>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold text-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy
                ? "…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>
        )}

        {(mode === "forgot" || confirmSent) && (
          <button
            onClick={() => {
              setMode("signin");
              setForgotSent(false);
              setConfirmSent(false);
              setError(null);
            }}
            className="mt-6 w-full text-sm text-muted-foreground underline"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
