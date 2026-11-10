import { lastDoneLabel, routineProgram } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { BusyLabel } from '@/components/busy-label';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';
import { useRoutineCapCheck } from '@/lib/pro';

/**
 * The user's saved routines, as the Workout tab lists them under Up next
 * (docs/workout-tab-spec.md): one card of compact rows, stalest first,
 * every day flat whatever routine it belongs to. A day's routine rides on
 * its meta line. Removing lives in the routine menu, not on the list.
 */

/** "6 exercises · Arnold Split · Done 4 days ago". */
export function routineRowMeta(t: HomeTemplate, today: Date = new Date()): string {
  const n = t.template_exercises.length;
  return [`${n} ${n === 1 ? 'exercise' : 'exercises'}`, routineProgram(t), lastDoneLabel(t.lastDone, today)]
    .filter(Boolean)
    .join(' · ');
}

export function RoutineRows({
  templates,
  busyId,
  disabled,
  onStart,
  onOpen,
  onMenu,
}: {
  templates: HomeTemplate[];
  /** The day whose start is running. */
  busyId: string | null;
  /** Something else is starting; no Start runs. */
  disabled: boolean;
  onStart: (t: HomeTemplate) => void;
  /** A tap on the row body. */
  onOpen?: (t: HomeTemplate) => void;
  onMenu: (t: HomeTemplate) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const today = new Date();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      {/* The clip lives on an inner view: overflow hidden on the card itself
          would cut its own shadow. */}
      <View style={styles.clip}>
        {templates.map((t, i) => {
          const doneToday = lastDoneLabel(t.lastDone, today) === DONE_TODAY;
          const busy = busyId === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={onOpen ? () => onOpen(t) : undefined}
              onLongPress={() => onMenu(t)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityHint="Long press for more"
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                pressed && onOpen && { backgroundColor: c.surface2 },
              ]}>
              <View style={[styles.rowText, doneToday && styles.dimmed]}>
                <View style={styles.nameLine}>
                  {doneToday ? (
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
                      size={16}
                      tintColor={c.success}
                      accessibilityLabel="Done today"
                      fallback={<Text style={[styles.checkGlyph, { color: c.success }]}>✓</Text>}
                    />
                  ) : null}
                  <Text style={[type.button, styles.name, { color: c.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
                <Text style={[type.meta, styles.meta, { color: c.text2 }]} numberOfLines={1}>
                  {routineRowMeta(t, today)}
                </Text>
              </View>
              <Pressable
                onPress={() => onStart(t)}
                disabled={busy || disabled}
                hitSlop={START_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`Start ${t.name}`}
                accessibilityState={{ busy, disabled: busy || disabled }}
                style={({ pressed }) => [styles.start, { borderColor: c.border }, pressed && styles.pressed]}>
                <BusyLabel label="Start" busy={busy} color={c.text} fontSize={14} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Rows while the tab waits for the saved routines. */
export function RoutineRowsSkeleton({ count }: { count: number }) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <View style={styles.rowText}>
            <SkeletonText variant={styles.name} width={i % 2 === 0 ? '55%' : '42%'} />
            <SkeletonText variant={type.meta} width="70%" />
          </View>
          <Skeleton width={56} height={START_HEIGHT} radius={radius.pill} />
        </View>
      ))}
    </View>
  );
}

/** `lastDoneLabel` for a day done today. */
const DONE_TODAY = 'Done today';

/** A Start pill: 14 pt text inside 6 pt of padding above and below, and a 1 pt border. */
const START_HEIGHT = 32;

/** Brings the 32 pt pill to the 44 pt minimum tap target. */
const START_SLOP = 6;

/**
 * Asks before Remove takes a routine. Every day of it goes; workouts
 * done from it, their PRs and the streak stay.
 */
export function confirmRemoveRoutine(program: string, onRemove: () => void) {
  Alert.alert(`Remove ${program}?`, 'Its days leave your routines. Your past workouts, PRs and streak stay.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onRemove },
  ]);
}

/**
 * The long-press menu on a saved day (rename, duplicate, share link,
 * delete) and the rename sheet. `reload` runs after a change the screen
 * must read back. Render `sheets` once in the screen.
 *
 * With `onRemove`, the last item is Remove routine and hands the day to
 * the screen, which removes the whole routine; without it, Delete routine
 * deletes that one day.
 */
export function useRoutineMenu({
  reload,
  userId,
  onRemove,
}: {
  reload: () => Promise<void>;
  userId: string | undefined;
  onRemove?: (t: HomeTemplate) => void;
}): { openMenu: (t: HomeTemplate) => void; sheets: ReactNode } {
  const menuRef = useRef<SheetRef>(null);
  const routineCapOk = useRoutineCapCheck();
  const renameRef = useRef<SheetRef>(null);
  const [menuTemplate, setMenuTemplate] = useState<HomeTemplate | null>(null);

  function openMenu(t: HomeTemplate) {
    setMenuTemplate(t);
    menuRef.current?.present();
  }

  async function onRoutineAction(action: RoutineAction) {
    menuRef.current?.dismiss();
    const t = menuTemplate;
    if (!t || !userId) return;
    if (action === 'rename') {
      renameRef.current?.present();
      return;
    }
    if (action === 'duplicate') {
      if (!(await routineCapOk(userId))) return;
      await home.saveTemplateCopy(userId, t);
      await reload();
      return;
    }
    if (action === 'share') {
      const url = await home.ensureShareLink(t.id);
      if (url) await Share.share({ message: `${t.name}: a routine on LiftCamp\n${url}`, url });
      return;
    }
    if (action === 'delete' && onRemove) {
      onRemove(t);
      return;
    }
    if (action === 'delete') {
      Alert.alert(`Delete ${t.name}?`, 'This removes the routine, not any logged workouts.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await home.deleteTemplate(t.id);
            await reload();
          },
        },
      ]);
    }
  }

  async function onRename(name: string) {
    renameRef.current?.dismiss();
    if (!menuTemplate) return;
    await home.renameTemplate(menuTemplate.id, name);
    await reload();
  }

  const sheets = (
    <>
      <RoutineMenuSheet
        ref={menuRef}
        template={menuTemplate}
        removeLabel={onRemove ? 'Remove routine' : undefined}
        onAction={(a) => void onRoutineAction(a)}
      />
      <RenameSheet ref={renameRef} initialName={menuTemplate?.name ?? ''} onSave={(n) => void onRename(n)} />
    </>
  );

  return { openMenu, sheets };
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card },
  clip: { borderRadius: radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 16, flexShrink: 1 },
  meta: { fontVariant: ['tabular-nums'] },
  checkGlyph: { fontSize: 14, lineHeight: 16, fontWeight: '700' },
  // Done today: the row steps back, its Start still works.
  dimmed: { opacity: 0.55 },
  // The outlined Start: border only, body text.
  start: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
