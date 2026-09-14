import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * Height comes from the content (`enableDynamicSizing`), capped at MAX_FRACTION
 * of the window. A four-row menu sizes itself; content taller than the cap
 * needs `scroll`, which swaps the body for the library's own ScrollView so
 * the scroll and the drag-to-dismiss gesture are arbitrated together rather
 * than fighting.
 *
 * Present it with `ref.current?.present()` and close with `dismiss()`. The app
 * root must render <BottomSheetModalProvider>.
 */
/** The most of the window a sheet may take. Leaves the parent visible above. */
const MAX_FRACTION = 0.85;

export const Sheet = forwardRef<
  SheetRef,
  { children: ReactNode; onDismiss?: () => void; scroll?: boolean }
>(function Sheet({ children, onDismiss, scroll = false }, ref) {
  const c = useColors();
  // The sheet sits on the bottom edge, so its content has to clear the home
  // indicator. The modal provider is inside the root SafeAreaProvider, so
  // the hook is correct here.
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const maxHeight = Math.round((windowH - insets.top) * MAX_FRACTION);
  const bodyStyle = [
    styles.content,
    { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
  ];

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
      maxDynamicContentSize={maxHeight}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, { backgroundColor: c.surface }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: c.text3 }]}>
      {scroll ? (
        <BottomSheetScrollView contentContainerStyle={bodyStyle} showsVerticalScrollIndicator={false}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={bodyStyle}>{children}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
});

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
  },
});
