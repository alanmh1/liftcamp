import type { PendingMerge } from '@liftcamp/shared';
import { useCallback, useEffect, useState } from 'react';

import { pendingMerges, retryMerge, subscribeGuestMerge } from '@/lib/guest-merge';
import { presentMergeFailure } from '@/lib/guest-merge-alert';

/**
 * A guest merge still waiting for this user, as guest or as account, for
 * the Settings row. `retry` runs it now and says so if it fails again.
 */
export function usePendingMerge(userId: string | undefined): {
  pending: PendingMerge | null;
  retrying: boolean;
  retry: () => void;
} {
  const [pending, setPending] = useState<PendingMerge | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const all = await pendingMerges();
    setPending(
      all.find((r) => r.stage !== 'merged' && (r.guestId === userId || r.targetId === userId)) ?? null,
    );
  }, [userId]);

  useEffect(() => {
    void refresh();
    return subscribeGuestMerge(() => void refresh());
  }, [refresh]);

  const retry = useCallback(() => {
    if (!pending || retrying) return;
    setRetrying(true);
    void retryMerge(pending.guestId)
      .then((result) => {
        if (result) presentMergeFailure(result);
      })
      .finally(() => {
        setRetrying(false);
        void refresh();
      });
  }, [pending, retrying, refresh]);

  return { pending, retrying, retry };
}
