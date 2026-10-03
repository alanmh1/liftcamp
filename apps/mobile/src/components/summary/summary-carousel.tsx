import type { StreakShare } from '@liftcamp/shared';
import { forwardRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { StreakCard } from '@/components/home/streak-card';
import { Medal } from '@/components/medals/medal';
import { ShareCard, type CardData, type CardKind } from '@/components/summary/share-card';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/** One page of the summary's carousel: a workout card, or the medal card the workout earned. */
export type SummaryPage = CardKind | 'medal';

/**
 * The summary's share cards as a paged carousel with page dots: the workout
 * cards, then, for a workout that earned a medal, the streak share card in
 * its medal layout. Drawn the same on the summary and in the dev gallery.
 * The ref is the horizontal ScrollView, which the summary's automatic pass
 * scrolls.
 */
export const SummaryCarousel = forwardRef<
  ScrollView,
  {
    pages: SummaryPage[];
    data: CardData;
    /** The streak share for the medal page; required when `pages` has one. */
    medalShare: StreakShare | null;
    /** The page width: the window's, so the paging snaps. */
    width: number;
    cardWidth: number;
    page: number;
    onPage: (page: number) => void;
    onScrollBeginDrag?: () => void;
  }
>(function SummaryCarousel({ pages, data, medalShare, width, cardWidth, page, onPage, onScrollBeginDrag }, ref) {
  const c = useColors();
  return (
    <>
      {/* The carousel pages at the full window width so the paging snaps,
          with the card inset by the screen padding on each page. */}
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={(e) => onPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.carousel}>
        {pages.map((p) => (
          <View key={p} style={[styles.page, { width }]}>
            <View style={styles.cardShadow}>
              {p === 'medal' ? (
                medalShare ? (
                  <StreakCard share={medalShare} size={cardWidth} />
                ) : null
              ) : (
                <ShareCard kind={p} data={data} size={cardWidth} />
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {pages.map((p, i) => (
          <View key={p} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
        ))}
      </View>
    </>
  );
});

/**
 * The summary's quiet note for a workout that earned a medal: the medal
 * small beside "You earned the 12-week medal". No animation and no haptic;
 * the medal's celebration is the week card's, on the next Home open.
 */
export function MedalEarnedLine({ weeks }: { weeks: number }) {
  const c = useColors();
  return (
    <View style={styles.earned} accessible accessibilityLabel={`You earned the ${weeks}-week medal`}>
      <Medal weeks={weeks} size={32} />
      <Text style={[type.meta, { color: c.text2 }]}>You earned the {weeks}-week medal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: { flexGrow: 0 },
  // Vertical room for the card's shadow, which the horizontal ScrollView
  // clips at its own bounds. The page width stays the window width, so the
  // paging still snaps; only the height grows.
  page: { alignItems: 'center', paddingVertical: spacing.lg },
  // The preview lifts off the page a little; the capture has no shadow,
  // because the exported image is the card alone.
  cardShadow: {
    borderRadius: radius.card,
    shadowColor: palettes.light.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  earned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
});
