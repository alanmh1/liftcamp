/**
 * How every scrolling screen under the tabs (and Settings) clears the
 * floating tab bar and the home indicator, in one place.
 *
 * `scrollInsetProps` hands the bottom to iOS: with automatic content inset
 * adjustment, UIKit insets the scroll view by the tab bar and the safe area,
 * whatever their size (the tab bar changes height between iPhones and iOS
 * versions, and minimizes on scroll in iOS 26), so no screen hard-codes a
 * tab bar height. `SCROLL_END_PADDING` is the room after the last item on
 * top of that, so it rests clear of the bar rather than flush against it.
 *
 * Spread the props on the ScrollView, FlatList or SectionList and put the
 * padding at the bottom of its content container. A screen without a
 * navigation header keeps its SafeAreaView for the top edge; the scroll
 * view inside it then only gets the bottom inset, never a doubled top.
 */
export const scrollInsetProps = { contentInsetAdjustmentBehavior: 'automatic' } as const;

/** Space after the last item, above the tab bar's inset. */
export const SCROLL_END_PADDING = 48;
