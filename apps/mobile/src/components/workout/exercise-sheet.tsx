import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export type SheetAction = 'replace' | 'reorder' | 'note' | 'remove';

/**
 * The ellipsis sheet, actions only for this session. The About, History,
 * Records and Charts tabs from the spec arrive with the exercise detail work.
 */
export function ExerciseSheet({
  visible,
  exerciseName,
  onAction,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  onAction: (action: SheetAction) => void;
  onClose: () => void;
}) {
  const c = useColors();

  const actions: { key: SheetAction; label: string; danger?: boolean }[] = [
    { key: 'replace', label: 'Replace exercise' },
    { key: 'reorder', label: 'Move down' },
    { key: 'note', label: 'Add note' },
    { key: 'remove', label: 'Remove exercise', danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SafeAreaView edges={['bottom']}>
          <Text style={[type.exerciseName, styles.title, { color: c.text }]} numberOfLines={1}>
            {exerciseName}
          </Text>

          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => onAction(a.key)}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: c.surface2 },
                pressed && styles.pressed,
              ]}>
              <Text style={[type.button, { color: a.danger ? c.danger : c.text }]}>{a.label}</Text>
            </Pressable>
          ))}

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={[type.button, { color: c.text2 }]}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000055',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.screen,
    gap: spacing.sm,
  },
  title: {
    marginBottom: spacing.sm,
  },
  action: {
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancel: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
