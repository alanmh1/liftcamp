import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — LiftCamp" },
      {
        name: "description",
        content: "Stop receiving LiftCamp emails at your address.",
      },
      { property: "og:title", content: "Unsubscribe — LiftCamp" },
      {
        property: "og:description",
        content: "Stop receiving LiftCamp emails at your address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

type State = "loading" | "confirm" | "working" | "done" | "already" | "invalid";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/email/unsubscribe?token=${encodeURIComponent(t)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.valid) setState("confirm");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!token) return;
    setState("working");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("invalid");
    } catch {
      setState("invalid");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12">
      <main className="w-full max-w-[420px] text-center">
        <h1 className="text-2xl font-bold tracking-tight">LiftCamp emails</h1>

        {state === "loading" && (
          <p className="mt-4 text-sm text-muted-foreground">Checking your link…</p>
        )}

        {state === "confirm" && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Unsubscribe this address from LiftCamp emails? You'll still get
              essential account emails like password resets.
            </p>
            <button
              onClick={confirm}
              className="mt-6 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state === "working" && (
          <p className="mt-4 text-sm text-muted-foreground">Updating…</p>
        )}

        {state === "done" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Done — you're unsubscribed. We won't email you again unless it's
            essential to your account.
          </p>
        )}

        {state === "already" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This address is already unsubscribed. Nothing else to do.
          </p>
        )}

        {state === "invalid" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This unsubscribe link isn't valid or has expired. If you're still
            getting emails, reply to one and we'll sort it out.
          </p>
        )}

        <Link
          to="/"
          className="mt-8 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to LiftCamp
        </Link>
      </main>
    </div>
  );
}
