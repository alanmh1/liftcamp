import { TipNote } from '@/components/tip-note';

/**
 * Above the rows of the first card given generated warm-ups, the first time
 * that happens for a user (lib/warmup-note.ts). Says why a row appeared and
 * where to turn it off.
 */
export function WarmupTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <TipNote onDismiss={onDismiss}>
      We added a warm-up before your first working set. Tap W to make it a working set, or turn warm-ups off in Settings.
    </TipNote>
  );
}
