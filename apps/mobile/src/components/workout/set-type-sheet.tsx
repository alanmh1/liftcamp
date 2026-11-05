import { forwardRef } from 'react';

import { Sheet, SheetMenu, type SheetRef } from '@/components/BottomSheet';

export type SetKind = 'warmup' | 'working';

/**
 * Opened from a set's number badge, on the live workout and in edit mode,
 * for every account: it changes a row that already exists, so it is outside
 * the Pro gate, which covers only the generated warm-up rows. A warm-up
 * never counts toward volume, set counts, records or PRs, so this is how a
 * row logged as the wrong kind is put right. The screen saves the choice.
 */
export const SetTypeSheet = forwardRef<SheetRef, { warmup: boolean; onPick: (kind: SetKind) => void }>(
  function SetTypeSheet({ warmup, onPick }, ref) {
    return (
      <Sheet ref={ref}>
        <SheetMenu
          items={[
            { key: 'warmup', label: 'Warm-up set', checked: warmup },
            { key: 'working', label: 'Working set', checked: !warmup },
          ]}
          onSelect={onPick}
        />
      </Sheet>
    );
  },
);
