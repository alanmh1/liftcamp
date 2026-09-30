import type { SyncStatus } from '@liftcamp/shared';
import { useEffect, useState } from 'react';

import { writeQueue } from '@/data/write-queue';

/** The write queue's status, updated as it sends. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState(() => writeQueue.status());
  useEffect(() => {
    setStatus(writeQueue.status());
    return writeQueue.subscribe(setStatus);
  }, []);
  return status;
}

/** How long sends must have been failing before the app says so. */
export const OFFLINE_NOTICE_MS = 5000;

/**
 * Whether to say the phone is holding writes: some are waiting, and sends
 * have been failing for OFFLINE_NOTICE_MS. Nothing shows while writes go
 * through normally, so a set checked with signal never flickers a notice.
 */
export function showsOfflineNotice(status: SyncStatus, now: number): boolean {
  return status.pending > 0 && status.failingSince != null && now - status.failingSince >= OFFLINE_NOTICE_MS;
}
