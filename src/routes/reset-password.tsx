import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — LiftCamp" },
      { name: "description", content: "Choose a new password for your LiftCamp account and get back to logging workouts." },
      { property: "og:title", content: "Reset password — LiftCamp" },
      { property: "og:description", content: "Choose a new password for your LiftCamp account and get back to logging workouts." },
      { property: "og:url", content: "https://liftcamp.app/reset-password" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/reset-password" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/", replace: true }), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>

          {done ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Password updated. Redirecting…
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  New password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-md bg-primary text-primary-foreground font-medium text-base disabled:opacity-50"
              >
                {busy ? "…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
