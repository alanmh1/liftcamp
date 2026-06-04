import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import logoAsset from "@/assets/replog-logo.svg.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — RepLog" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [forgotSent, setForgotSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [session, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setForgotSent(true);
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoAsset.url} alt="" className="h-10 w-10" />
            <h1 className="font-display text-3xl">RepLog</h1>
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Sign in to log workouts."}
            {mode === "signup" && "Create an account."}
            {mode === "forgot" && "Enter your email and we'll send you a reset link."}
          </p>

          {mode === "forgot" && forgotSent ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Check your email for a reset link.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </label>
                <input
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
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); }}
                  className="block text-sm text-muted-foreground underline"
                >
                  Forgot password?
                </button>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-md bg-primary text-primary-foreground font-medium text-base disabled:opacity-50"
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

          <button
            onClick={() => {
              if (mode === "forgot") {
                setMode("signin");
              } else {
                setMode(mode === "signin" ? "signup" : "signin");
              }
              setError(null);
            }}
            className="mt-6 w-full text-sm text-muted-foreground underline"
          >
            {mode === "signin"
              ? "Need an account? Sign up."
              : mode === "signup"
                ? "Have an account? Sign in."
                : "Back to sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
