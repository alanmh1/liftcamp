import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { EVENTS, track } from "@/lib/analytics";
import { claimTrialLog, meaningfulSets, readTrialLog } from "@/lib/trial-log";

/**
 * Turns a signed-out visitor's scratch log into a real workout the moment they
 * have a session. Mounted once at the root so it fires wherever the sign-up
 * flow happens to land them.
 */
export function TrialLogClaimer() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claimed = useRef(false);

  useEffect(() => {
    if (loading || !user || claimed.current) return;
    if (meaningfulSets(readTrialLog()).length === 0) return;
    claimed.current = true;

    void (async () => {
      const workoutId = await claimTrialLog(user.id);
      if (!workoutId) return;
      void track(EVENTS.trialClaimed, {});
      toast.success("Your sets are saved to your account.");
      navigate({ to: "/workout/$workoutId", params: { workoutId } });
    })();
  }, [loading, user, navigate]);

  return null;
}
