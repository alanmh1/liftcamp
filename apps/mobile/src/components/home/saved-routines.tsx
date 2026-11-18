import { lastDoneLabel, routineProgram, type TabStack } from '@liftcamp/shared';
import { useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { BusyLabel } from '@/components/busy-label';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { useTabStack } from '@/components/tab-layout';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';
import { useRoutineCapCheck } from '@/lib/pro';

/**
 * The user's saved routines, as the Workout tab lists them under Up next:
 * one card of compact rows, every day flat whatever routine it belongs to,
 * in the order the caller gives (Your rotation, then the routines out of
 * it under "Not in rotation"). A day's routine rides on its meta line.
 * Removing lives in the routine menu, not on the list.
 */

/**
 * The routine builder (docs/routine-builder-spec.md), a root modal: a new
 * routine, or `id` to edit one of the user's own. `stack` is the tab the
 * builder opened from, so a new routine's detail is pushed back there.
 */
export function routineBuilderHref(stack: TabStack, id?: string): Href {
  const params: Record<string, string> = {};
  if (stack) params.stack = stack;
  if (id) params.id = id;
  return { pathname: '/routine-builder', params };
}

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
  upNextId,
  numbered = false,
  others = [],
  toggle,
}: {
  templates: HomeTemplate[];
  /** The routine Up next offers, tagged "Up next" on its row. */
  upNextId?: string;
  /** The day whose start is running. */
  busyId: string | null;
  /** Something else is starting; no Start runs. */
  disabled: boolean;
  onStart: (t: HomeTemplate) => void;
  /** A tap on the row body. */
  onOpen?: (t: HomeTemplate) => void;
  onMenu: (t: HomeTemplate) => void;
  /** A rotation position badge (1, 2, 3) at the left of each of `templates`. */
  numbered?: boolean;
  /** Routines out of the rotation, after `templates` under a "Not in rotation" label, no badge. */
  others?: HomeTemplate[];
  /** Show all / Show less, a full-width row at the bottom of the card. */
  toggle?: { expanded: boolean; total: number; onPress: () => void };
}) {
  const { scheme, colors: c } = useTheme();
  const today = new Date();
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border };

  function row(t: HomeTemplate, first: boolean, badge: number | null) {
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
          !first && divider,
          pressed && onOpen && { backgroundColor: c.surface2 },
        ]}>
        {badge != null ? (
          <View style={[styles.badge, { backgroundColor: c.accentSoft }]} accessibilityLabel={`Number ${badge}`}>
            <Text style={[type.meta, styles.badgeText, { color: c.accentText }]}>{badge}</Text>
          </View>
        ) : null}
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
            {t.id === upNextId ? (
              <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
                <Text style={[type.meta, styles.tagText, { color: c.accentText }]}>Up next</Text>
              </View>
            ) : null}
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
  }

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      {/* The clip lives on an inner view: overflow hidden on the card itself
          would cut its own shadow. */}
      <View style={styles.clip}>
        {templates.map((t, i) => row(t, i === 0, numbered ? i + 1 : null))}
        {others.length > 0 ? (
          <Fragment>
            <View style={[styles.groupLabel, templates.length > 0 && divider]}>
              <Text style={[type.label, { color: c.text3 }]}>Not in rotation</Text>
            </View>
            {/* The label is the group's top edge; its first row needs no rule. */}
            {others.map((t, i) => row(t, i === 0, null))}
          </Fragment>
        ) : null}
        {toggle ? (
          <Pressable
            onPress={toggle.onPress}
            accessibilityRole="button"
            accessibilityState={{ expanded: toggle.expanded }}
            style={({ pressed }) => [
              styles.toggle,
              (templates.length > 0 || others.length > 0) && divider,
              pressed && { backgroundColor: c.surface2 },
            ]}>
            <Text style={[type.button, styles.toggleText, { color: c.accentText }]}>
              {toggle.expanded ? 'Show less' : `Show all ${toggle.total} routines`}
            </Text>
            <SymbolView
              name={
                toggle.expanded
                  ? { ios: 'chevron.up', android: 'expand_less' }
                  : { ios: 'chevron.down', android: 'expand_more' }
              }
              size={12}
              weight="semibold"
              tintColor={c.accentText}
              fallback={
                <Text style={[styles.toggleText, { color: c.accentText }]}>{toggle.expanded ? '˄' : '˅'}</Text>
              }
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Rows while the tab waits for the saved routines. */
export function RoutineRowsSkeleton({
  count,
  numbered = false,
  toggle = false,
}: {
  count: number;
  /** A badge placeholder on each row, as RoutineRows' `numbered`. */
  numbered?: boolean;
  /** A Show all row at the bottom, as RoutineRows' `toggle`. */
  toggle?: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border };
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.clip}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.row, i > 0 && divider]}>
            {numbered ? <Skeleton width={22} height={22} radius={11} /> : null}
            <View style={styles.rowText}>
              <SkeletonText variant={styles.name} width={i % 2 === 0 ? '55%' : '42%'} />
              <SkeletonText variant={type.meta} width="70%" />
            </View>
            <Skeleton width={56} height={START_HEIGHT} radius={radius.pill} />
          </View>
        ))}
        {toggle ? (
          <View style={[styles.toggle, count > 0 && divider]}>
            <SkeletonText variant={styles.toggleText} width="40%" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** `lastDoneLabel` for a day done today. */
const DONE_TODAY = 'Done today';

/**
 * A Start pill: an 18 pt line of 14 pt text (`labelLineHeight(14)`) inside
 * 6 pt of padding above and below, and a 1 pt border. The pill and its
 * skeleton both use it as their height floor.
 */
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
 * The long-press menu on a saved day (edit in the routine builder, rename,
 * add to or remove from the rotation, duplicate, share link, delete) and the rename sheet. `reload` runs after a change the screen
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
  const router = useRouter();
  const stack = useTabStack();
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
    if (action === 'edit') {
      router.push(routineBuilderHref(stack, t.id));
      return;
    }
    if (action === 'rename') {
      renameRef.current?.present();
      return;
    }
    if (action === 'rotation') {
      const on = t.in_rotation === false;
      const ok = await home.setInRotation(userId, t.id, on);
      if (!ok) {
        Alert.alert(on ? 'Could not add it to your rotation.' : 'Could not remove it from your rotation.', 'Try again.');
        return;
      }
      await reload();
      return;
    }
    if (action === 'duplicate') {
      if (!(await routineCapOk(userId))) return;
      // A copy starts out of the rotation, so Up next does not offer the
      // same routine twice.
      await home.saveTemplateCopy(userId, t, false, false);
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
  // The rotation position, 1 after Up next.
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  groupLabel: { paddingHorizontal: spacing.card, paddingTop: spacing.md, paddingBottom: spacing.xs },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  toggleText: { fontSize: 15, fontVariant: ['tabular-nums'] },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 16, flexShrink: 1 },
  meta: { fontVariant: ['tabular-nums'] },
  checkGlyph: { fontSize: 14, lineHeight: 16, fontWeight: '700' },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, flexShrink: 0 },
  tagText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  // Done today: the row steps back, its Start still works.
  dimmed: { opacity: 0.55 },
  // The outlined Start: border only, body text.
  start: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    // Height comes from minHeight and the centred label, not from padding
    // around the text box, so Dynamic Type grows it and nothing else does.
    minHeight: START_HEIGHT,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
