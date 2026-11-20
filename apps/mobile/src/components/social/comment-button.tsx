import { commentCountLabel } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useCommentCount } from '@/lib/comments';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular } from '@/theme/tokens';

/**
 * The speech bubble and the comment count, beside the kudos thumb on a
 * feed card and on the read-only friend workout. Shown only with a mutual
 * follow (can_interact), like the thumb. A tap opens the workout's
 * comments in the stack it is in.
 *
 * The count is the read's, or the comments screen's when it changed it
 * this run (lib/comments.ts).
 */
export function CommentButton({
  workoutId,
  workoutName,
  fromRead,
}: {
  workoutId: string;
  workoutName: string | null;
  fromRead: number;
}) {
  const c = useColors();
  const router = useRouter();
  const navHref = useNavHref();
  const { session } = useAuth();
  const count = useCommentCount(session?.user.id ?? null, workoutId, fromRead);
  return (
    <Pressable
      onPress={() => router.push(navHref({ kind: 'comments', id: workoutId, name: workoutName }))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={commentCountLabel(count)}
      accessibilityHint="Opens the comments"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'bubble.left', android: 'chat_bubble' }}
        size={21}
        tintColor={c.text2}
        fallback={<Text style={{ color: c.text2, fontSize: 18 }}>💬</Text>}
      />
      <Text style={[styles.count, { color: c.text2 }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm },
  count: { fontSize: 15, fontWeight: '600', ...tabular },
  pressed: { opacity: 0.6 },
});
