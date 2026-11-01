import { useId, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "done" | "error";

/**
 * Small, secondary "Coming to Android" email capture. Writes to
 * `android_waitlist`, which anon may only INSERT into (no SELECT, so the
 * insert asks for nothing back). Emails are unique on lower(email): a
 * repeat sign-up is a 23505 and counts as success.
 */
export function AndroidNotify({
  source,
  tone = "light",
  className,
}: {
  source:
    | "hero"
    | "cta"
    | "exercises"
    | "routines"
    | "routine-detail"
    | "builder"
    | "guide-detail"
    | "strength";
  tone?: "light" | "dark";
  className?: string;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    const { error } = await supabase
      .from("android_waitlist")
      .insert({ email: email.trim(), source });
    if (error && error.code !== "23505") {
      setStatus("error");
      return;
    }
    setStatus("done");
    void track(EVENTS.androidWaitlistJoined, { source });
  }

  return (
    <div data-tone={tone} className={cn("group mt-ds-md w-full max-w-md", className)}>
      <p className="font-caption text-caption text-muted-foreground group-data-[tone=dark]:text-primary-foreground/80">
        Free on iPhone. Coming to Android.
      </p>
      {status === "done" ? (
        <p
          className="mt-ds-sm font-caption text-caption text-foreground group-data-[tone=dark]:text-primary-foreground"
          role="status"
        >
          Thanks. We will email you the day it lands.
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mt-ds-sm flex gap-ds-sm">
            <label htmlFor={id} className="sr-only">
              Email address
            </label>
            <input
              id={id}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-ds-md font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring group-data-[tone=dark]:border-primary-foreground/30 group-data-[tone=dark]:bg-primary-foreground/10 group-data-[tone=dark]:text-primary-foreground group-data-[tone=dark]:placeholder:text-primary-foreground/60 group-data-[tone=dark]:focus:ring-primary-foreground/60"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="h-10 shrink-0 rounded-full border border-border bg-background px-ds-md font-label text-sm text-foreground hover:bg-muted disabled:opacity-60 group-data-[tone=dark]:border-primary-foreground/30 group-data-[tone=dark]:bg-transparent group-data-[tone=dark]:text-primary-foreground group-data-[tone=dark]:hover:bg-primary-foreground/10"
            >
              Notify me
            </button>
          </form>
          {status === "error" && (
            <p
              className="mt-ds-xs font-caption text-caption text-destructive group-data-[tone=dark]:text-primary-foreground"
              role="alert"
            >
              Something went wrong. Try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
