import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { clearPendingRoutine, readPendingRoutine } from "@/lib/routine-share";
import { getSharedRoutine } from "@/lib/share-routine.functions";
import { createTemplateFromExercises } from "@/lib/templates";

/**
 * Copies the routine a visitor arrived on into their account once they finish
 * signing in. Mounted at the root so it fires wherever the auth flow lands.
 */
export function SharedRoutineClaimer() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claimed = useRef(false);

  useEffect(() => {
    if (loading || !user || claimed.current) return;
    const token = readPendingRoutine();
    if (!token) return;
    claimed.current = true;

    void (async () => {
      clearPendingRoutine();
      try {
        const routine = await getSharedRoutine({ data: { token } });
        if (!routine || routine.exercises.length === 0) return;
        const id = await createTemplateFromExercises(
          user.id,
          routine.name,
          routine.exercises.map((e) => e.id),
        );
        if (!id) return;
        toast.success(`${routine.name} added to your routines.`);
        navigate({ to: "/" });
      } catch {
        /* a dead link should never block sign-in */
      }
    })();
  }, [loading, user, navigate]);

  return null;
}
