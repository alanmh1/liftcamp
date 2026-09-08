import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { flushOutbox, subscribeToOutbox } from "@/lib/offline-queue";

/**
 * Watches connectivity and drains the write outbox whenever the device comes
 * back. SSR-safe: everything happens in effects, and the first render always
 * claims "online, nothing pending" so hydration matches.
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const qc = useQueryClient();

  useEffect(() => subscribeToOutbox(setPending), []);

  useEffect(() => {
    setOnline(navigator.onLine);

    let cancelled = false;
    async function drain() {
      const synced = await flushOutbox(supabase as never);
      if (synced > 0 && !cancelled) {
        // The server now holds the truth; refetch so positions and defaults
        // written by the database land in the cache.
        qc.invalidateQueries();
      }
    }

    function goOnline() {
      setOnline(true);
      void drain();
    }
    function goOffline() {
      setOnline(false);
    }
    function onVisible() {
      if (document.visibilityState === "visible" && navigator.onLine) void drain();
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    void drain();
    const id = window.setInterval(() => void drain(), 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [qc]);

  return { online, pending };
}
