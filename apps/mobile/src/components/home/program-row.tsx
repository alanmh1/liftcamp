import { FALLBACK_IMAGE, matchHeading, type ProgramMatch } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ProgramGridTile,
  programTintSlots,
  ProgramGridTileSkeleton,
  SHADOW_ROOM,
  TileRows,
  type RoutineArt,
} from '@/components/home/routine-grid';
import { SkeletonText } from '@/components/skeleton';
import { SoftPill } from '@/components/soft-pill';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import type { TrainingPrefs } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/** How many programs the row shows; See all in the heading opens the rest. */
export const PROGRAM_ROW_LIMIT = 6;

/**
 * 175 wide: the width a tile gets in the routines browser's two columns on
 * an iPhone 17 Pro (402 pt, less 20 pt screen padding a side and the 12 pt
 * gap, halved), so a routine tile is the same size on both screens.
 */
const TILE_WIDTH = 175;
const GAP = spacing.md;

/**
 * The starter programs as one horizontal row, on Home (until a routine is
 * saved) and on the Workout tab: a heading with See all, a sub-line that
 * says why these programs, then up to six `ProgramGridTile`s, each in a
 * cell of TILE_WIDTH, with the browser's meta line. The heading's
 * See all carries the number of matching routines. The list is `starterPrograms`, matched to the profile's level
 * and equipment. A tile pushes the routine's detail on this tab's stack,
 * whose Use routine saves every variation as the user's own; the host
 * reads again when it is back in focus.
 *
 * The row runs edge to edge: it pulls the host's screen padding back with
 * a negative margin and pads its content by the same amount, so the first
 * card lines up with the text above and the last scrolls to the edge. It
 * pads above and below for the card shadows, which the scroll view would
 * otherwise clip, and takes the same room back with a negative margin.
 */
export function ProgramRow({
  title,
  match,
  art,
  prefs,
  disabled,
  onSeeAll,
}: {
  title: string;
  match: ProgramMatch & { matched: boolean };
  /** From the full system list, so a card's image is the same everywhere. */
  art: RoutineArt;
  prefs: TrainingPrefs;
  /** Something else on the screen is busy; tiles do not open. */
  disabled: boolean;
  /** The full program browser. */
  onSeeAll: () => void;
}) {
  const c = useTheme().colors;
  const router = useRouter();
  const navHref = useNavHref();

  const { programs } = match;
  const shown = programs.slice(0, PROGRAM_ROW_LIMIT);
  const tints = programTintSlots(shown, art);
  if (programs.length === 0) return null;

  return (
    <View style={styles.section}>
      <View>
        <View style={styles.head}>
          <Text style={[type.exerciseName, { color: c.text }]}>{title}</Text>
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all ${programs.length} routines`}>
            <Text style={[type.button, styles.count, { color: c.accentText, fontSize: 14 }]}>
              See all {programs.length}
            </Text>
          </Pressable>
        </View>
        <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
          {whyLine(match, prefs)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE_WIDTH + GAP}
        decelerationRate="fast"
        style={styles.scroller}
        contentContainerStyle={styles.row}>
        {shown.map((g) => (
          <View key={g.program} style={styles.tile}>
            <ProgramGridTile
              group={g}
              image={art.get(g.program) ?? FALLBACK_IMAGE}
              tint={tints.get(g.program) ?? 0}
              meta="daysAndWorkouts"
              disabled={disabled}
              onPress={() => router.push(navHref({ kind: 'starterRoutine', program: g.program }))}
            />
          </View>
        ))}
      </ScrollView>

    </View>
  );
}

/** The row's shape before the routines and the prefs load. */
export function ProgramRowSkeleton({ title }: { title: string }) {
  const c = useTheme().colors;
  return (
    <View style={styles.section}>
      <View>
        <View style={styles.head}>
          <Text style={[type.exerciseName, { color: c.text }]}>{title}</Text>
        </View>
        <SkeletonText variant={type.meta} width="58%" />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.tile}>
            <ProgramGridTileSkeleton index={i} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** How many programs the Workout tab's grid shows. */
export const PROGRAM_GRID_LIMIT = 4;

/** The sub-line under Find a routine: why these programs. */
function whyLine(match: ProgramMatch & { matched: boolean }, prefs: TrainingPrefs): string {
  // With no level answer the list is the beginner default (see
  // starterPrograms), so the sub-line names that.
  const level = match.matched ? prefs.level : null;
  return level ? matchHeading(level, prefs.equipment, match) : 'Beginner routines';
}

/**
 * Find a routine on the Workout tab (docs/routine-builder-spec.md): the
 * same heading and sub-line as the row, a See All pill for the full
 * browser, then the first four starter programs as a 2×2 grid of
 * `ProgramGridTile`. Fewer than four shows what there is. A tile pushes
 * the routine's detail on this tab's stack. Home keeps `ProgramRow`.
 */
export function ProgramGrid({
  title,
  match,
  art,
  prefs,
  disabled,
  onSeeAll,
}: {
  title: string;
  match: ProgramMatch & { matched: boolean };
  /** From the full system list, so a tile's image is the same everywhere. */
  art: RoutineArt;
  prefs: TrainingPrefs;
  /** Something else on the screen is busy; tiles do not open. */
  disabled: boolean;
  /** The full program browser. */
  onSeeAll: () => void;
}) {
  const c = useTheme().colors;
  const router = useRouter();
  const navHref = useNavHref();
  const { programs } = match;
  const shown = programs.slice(0, PROGRAM_GRID_LIMIT);
  const tints = programTintSlots(shown, art);
  if (programs.length === 0) return null;
  return (
    <View style={styles.section}>
      <GridHeading title={title} onSeeAll={onSeeAll}>
        <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
          {whyLine(match, prefs)}
        </Text>
      </GridHeading>
      <TileRows
        items={shown}
        keyOf={(g) => g.program}
        render={(g) => (
          <ProgramGridTile
            group={g}
            image={art.get(g.program) ?? FALLBACK_IMAGE}
            tint={tints.get(g.program) ?? 0}
            disabled={disabled}
            onPress={() => router.push(navHref({ kind: 'starterRoutine', program: g.program }))}
          />
        )}
      />
    </View>
  );
}

/** The grid's shape before the routines and the prefs load: four tiles. */
export function ProgramGridSkeleton({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <GridHeading title={title}>
        <SkeletonText variant={type.meta} width="58%" />
      </GridHeading>
      <TileRows
        items={[0, 1, 2, 3]}
        keyOf={String}
        render={(i) => <ProgramGridTileSkeleton index={i} />}
      />
    </View>
  );
}

/** Title and sub-line on the left, the See All pill on the right. */
function GridHeading({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: ReactNode }) {
  const c = useTheme().colors;
  return (
    <View style={styles.gridHead}>
      <View style={styles.gridHeadText}>
        <Text style={[type.exerciseName, { color: c.text }]}>{title}</Text>
        {children}
      </View>
      {onSeeAll ? <SoftPill label="See All" accessibilityLabel="See all routines" onPress={onSeeAll} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroller: { marginHorizontal: -spacing.screen, marginVertical: -SHADOW_ROOM },
  row: { gap: GAP, paddingHorizontal: spacing.screen, paddingVertical: SHADOW_ROOM },
  tile: { width: TILE_WIDTH },
  count: { fontVariant: ['tabular-nums'] },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gridHeadText: { flex: 1 },
});
