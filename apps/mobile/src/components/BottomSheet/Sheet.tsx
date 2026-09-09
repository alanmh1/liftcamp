import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useColors } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

export type SheetRef = BottomSheetModal;

/**
 * The app's bottom sheet.
 *
 * Slides up from the bottom at full viewport width, surface fill, 20 radius on
 * the top corners, a short grab handle, and a dimmed backdrop. It closes on a
 * drag down or a tap outside; nothing here provides a Cancel button, because
 * those two gestures are the dismissal.
 *
 * Height comes from the content (`enableDynamicSizing`), so a four-row menu and
 * a full exercise detail both size themselves without snap points.
 *
 * Present it with `ref.current?.present()` and close with `dismiss()`. The app
 * root must render <BottomSheetModalProvider>.
 */
export const Sheet = forwardRef<SheetRef, { children: ReactNode; onDismiss?: () => void }>(
  function Sheet({ children, onDismiss }, ref) {
    const c = useColors();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.4}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        onDismiss={onDismiss}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.background, { backgroundColor: c.surface }]}
        handleIndicatorStyle={[styles.handle, { backgroundColor: c.text3 }]}>
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  handle: {
    width: 36,
    height: 4,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
});
