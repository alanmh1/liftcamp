import { templateLevelLabel } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { RoutineCard } from '@/components/home/routine-card';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate, UserRoutineGroup } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The user's saved routines, as the Workout tab lists them: a routine's
 * days under its name, with the trash that removes the whole routine, and
 * a routine with no program as a row on its own.
 */

/** 20 pt icon plus 12 on every side: the 44 pt minimum tap target. */
const TRASH_SLOP = 12;

/** A group to draw: the days shown, and every day's id for Remove. */
export type SavedRoutineGroup = UserRoutineGroup & { allIds: string[] };

/** Each group with every day's id, so Remove takes the whole routine. Empty groups are dropped. */
export function savedRoutineGroups(groups: UserRoutineGroup[]): SavedRoutineGroup[] {
  return groups
    .map((g) => ({ ...g, allIds: g.templates.map((t) => t.id) }))
    .filter((g) => g.templates.length > 0);
}

export function SavedRoutineGroups({
  groups,
  busyId,
  disabled,
  onStart,
  onMenu,
  onRemove,
}: {
  groups: SavedRoutineGroup[];
  /** The day whose start is running. */
  busyId: string | null;
  /** Something else is starting; no Start runs. */
  disabled: boolean;
  onStart: (t: HomeTemplate) => void;
  onMenu: (t: HomeTemplate) => void;
  onRemove: (program: string, templateIds: string[]) => void;
}) {
  const c = useColors();
  return (
    <>
      {groups.map((g) => (
        <View key={g.key} style={styles.routineGroup}>
          {g.program ? (
            <View style={styles.routineHead}>
              <Text style={[type.meta, styles.routineHeading, { color: c.text2 }]} numberOfLines={1}>
                {g.program}
                {templateLevelLabel(g.level) ? `  ·  ${templateLevelLabel(g.level)}` : ''}
              </Text>
              <Pressable
                onPress={() => onRemove(g.program!, g.allIds)}
                hitSlop={TRASH_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${g.program}`}
                style={({ pressed }) => [styles.trash, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete' }}
                  size={16}
                  tintColor={c.text3}
                  fallback={<Text style={[styles.trashGlyph, { color: c.text3 }]}>🗑</Text>}
                />
              </Pressable>
            </View>
          ) : null}
          {g.templates.map((t) => (
            <RoutineCard
              key={t.id}
              template={t}
              lastDone={t.lastDone}
              primaryLabel="Start"
              onPrimary={() => onStart(t)}
              onLongPress={() => onMenu(t)}
              onMore={() => onMenu(t)}
              busy={busyId === t.id}
              disabled={disabled}
            />
          ))}
        </View>
      ))}
    </>
  );
}

/**
 * Asks before the trash removes a routine. Every day of it goes; workouts
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
 */
export function useRoutineMenu({
  reload,
  userId,
}: {
  reload: () => Promise<void>;
  userId: string | undefined;
}): { openMenu: (t: HomeTemplate) => void; sheets: ReactNode } {
  const menuRef = useRef<SheetRef>(null);
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
      await home.saveTemplateCopy(userId, t);
      await reload();
      return;
    }
    if (action === 'share') {
      const url = await home.ensureShareLink(t.id);
      if (url) await Share.share({ message: `${t.name}: a routine on LiftCamp\n${url}`, url });
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
      <RoutineMenuSheet ref={menuRef} template={menuTemplate} onAction={(a) => void onRoutineAction(a)} />
      <RenameSheet ref={renameRef} initialName={menuTemplate?.name ?? ''} onSave={(n) => void onRename(n)} />
    </>
  );

  return { openMenu, sheets };
}

const styles = StyleSheet.create({
  routineGroup: { gap: spacing.sm },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routineHeading: { flex: 1, fontWeight: '600' },
  // A 20 pt icon box; TRASH_SLOP brings the tap target to 44 pt without
  // making the label row taller.
  trash: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  trashGlyph: { fontSize: 15, lineHeight: 18 },
  pressed: { opacity: 0.8 },
});
