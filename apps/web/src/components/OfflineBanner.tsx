import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

/**
 * A thin status strip, not a modal. Offline logging only works if people trust
 * it, and trust needs a visible "your sets are saved on this phone" signal
 * plus an explicit "synced" confirmation when the network returns.
 */
export function OfflineBanner() {
  const { online, pending } = useOfflineSync();
  const [justSynced, setJustSynced] = useState(false);
  const [wasBacklogged, setWasBacklogged] = useState(false);

  useEffect(() => {
    if (pending > 0) {
      setWasBacklogged(true);
      return;
    }
    if (!wasBacklogged || !online) return;
    setWasBacklogged(false);
    setJustSynced(true);
    const t = setTimeout(() => setJustSynced(false), 3000);
    return () => clearTimeout(t);
  }, [pending, online, wasBacklogged]);

  if (online && pending === 0 && !justSynced) return null;

  const offline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 mx-auto w-full max-w-[480px] px-3 pt-2"
    >
      <div
        className={
          offline || pending > 0
            ? "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium shadow-sm"
            : "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium text-muted-foreground shadow-sm"
        }
      >
        {offline || pending > 0 ? (
          <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>
          {offline
            ? pending > 0
              ? `Offline. ${pending} change${pending === 1 ? "" : "s"} saved on this phone`
              : "Offline. Your sets are saved on this phone"
            : pending > 0
              ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
              : "All changes synced"}
        </span>
      </div>
    </div>
  );
}
