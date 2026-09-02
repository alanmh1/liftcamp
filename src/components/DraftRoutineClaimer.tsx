import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { claimDraftRoutine, isClaimable, readDraftRoutine } from "@/lib/draft-routine";

/**
 * Turns a signed-out visitor's routine draft into a real template the moment
 * they have a session. Mounted once at the root so it fires wherever the
 * sign-up flow happens to land them.
 */
export function DraftRoutineClaimer() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claimed = useRef(false);

  useEffect(() => {
    if (loading || !user || claimed.current) return;
    if (!isClaimable(readDraftRoutine())) return;
    claimed.current = true;

    void (async () => {
      const templateId = await claimDraftRoutine(user.id);
      if (!templateId) return;
      toast.success("Your routine is saved to your account.");
      navigate({ to: "/" });
    })();
  }, [loading, user, navigate]);

  return null;
}
