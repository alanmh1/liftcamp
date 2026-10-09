import { requestsLine, splitFollows } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { settingsStyles } from '@/components/settings-ui';
import { useInvite } from '@/components/social/follow-actions';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useFollowRows } from '@/lib/follows';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The following feed's place on Home, under the last workout card, drawn
 * only with the social flag (docs/social-spec.md, Home and Feed).
 *
 * - While requests wait on the user, one line above everything else
 *   ("@will wants to follow you"), which opens Profile, Followers.
 * - Following nobody yet: the "Train with friends" card with Invite.
 *
 * The feed itself comes with the social-feed branch. Until then, someone
 * who follows people sees only the requests line here. Nothing draws
 * until the follow rows are in (lib/follows.ts), so the card never flashes
 * for someone who follows people.
 */
export function FollowingFeedSlot() {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const rows = useFollowRows(me);
  const router = useRouter();
  const navHref = useNavHref();
  const { scheme, colors: c } = useTheme();
  const { invite, busy } = useInvite();

  if (!me || !rows) return null;
  const lists = splitFollows(rows, me, Date.now());
  const line = requestsLine(lists.requests, me);

  return (
    <View style={styles.slot}>
      {line ? (
        <Pressable
          onPress={() => router.push(navHref({ kind: 'followers' }))}
          accessibilityRole="button"
          accessibilityHint="Opens your follow requests"
          style={({ pressed }) => [styles.line, { backgroundColor: c.accentSoft }, pressed && settingsStyles.pressed]}>
          <Text style={[type.button, { color: c.accentText, fontSize: 14 }]} numberOfLines={2}>
            {line}
          </Text>
        </Pressable>
      ) : null}

      {lists.following.length === 0 ? (
        <View style={[styles.card, cardSurface(scheme, c)]}>
          <Text style={[type.exerciseName, { color: c.text }]}>Train with friends</Text>
          <Text style={[type.meta, styles.body, { color: c.text2 }]}>
            Send a friend your invite link to see each other's workouts. Each of you approves who follows you.
          </Text>
          <Pressable
            onPress={() => void invite()}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.invite, { backgroundColor: c.accent }, (pressed || busy) && settingsStyles.pressed]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[type.button, styles.inviteLabel]}>Invite</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { gap: spacing.md },
  line: { borderRadius: radius.bar, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  body: { fontSize: 15 },
  invite: {
    alignSelf: 'flex-start',
    borderRadius: radius.bar,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    minWidth: 96,
    alignItems: 'center',
  },
  inviteLabel: { color: '#FFFFFF' },
});
