import { requestsLine, splitFollows } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { settingsStyles } from '@/components/settings-ui';
import { EnterCodeSheet, useInvite } from '@/components/social/follow-actions';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useFollowRows, useRefreshFollowsOnFocus } from '@/lib/follows';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The following feed's place on Home, under the last workout card, drawn
 * only with the social flag (docs/social-spec.md, Home and Feed).
 *
 * - While requests wait on the user, one line above everything else
 *   ("@will wants to follow you"), which opens Profile, Followers.
 * - Following nobody yet: the "Train with friends" card. Invite opens the
 *   share sheet, "Have a code?" the Enter invite code sheet, and a tap
 *   anywhere else on the card opens Profile, Following.
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
  // Mounted only with social on, inside Home, so this reads on each focus
  // of Home, including after the invite screen closes over it.
  useRefreshFollowsOnFocus(me);
  const router = useRouter();
  const navHref = useNavHref();
  const { scheme, colors: c } = useTheme();
  const { invite, busy } = useInvite();
  const codeRef = useRef<SheetRef>(null);

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
        // The card opens Following; its two buttons take their own taps.
        // Not one accessibility element, so VoiceOver and TalkBack reach
        // both buttons; Following is also on Profile for them.
        <Pressable
          onPress={() => router.push(navHref({ kind: 'following' }))}
          accessible={false}
          style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && settingsStyles.pressed]}>
          <Text style={[type.exerciseName, { color: c.text }]}>Train with friends</Text>
          <Text style={[type.meta, styles.body, { color: c.text2 }]}>
            Send a friend your invite link to see each other's workouts. Each of you approves who follows you.
          </Text>
          <View style={styles.actions}>
            <Pressable
              // Not `disabled` while busy: a disabled Pressable lets the tap
              // through to the card. invite() ignores a second tap itself.
              onPress={() => void invite()}
              accessibilityRole="button"
              accessibilityState={{ busy }}
              style={({ pressed }) => [styles.invite, { backgroundColor: c.accent }, (pressed || busy) && settingsStyles.pressed]}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[type.button, styles.inviteLabel]}>Invite</Text>}
            </Pressable>
            <Pressable
              onPress={() => codeRef.current?.present()}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.code, pressed && settingsStyles.pressed]}>
              <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>Have a code?</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      <EnterCodeSheet ref={codeRef} onDone={() => codeRef.current?.dismiss()} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { gap: spacing.md },
  line: { borderRadius: radius.bar, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  body: { fontSize: 15 },
  invite: {
    borderRadius: radius.bar,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 96,
    alignItems: 'center',
  },
  inviteLabel: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs },
  code: { paddingVertical: spacing.xs },
});
