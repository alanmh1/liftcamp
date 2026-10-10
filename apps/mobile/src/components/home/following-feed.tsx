import { filterFeed, splitFollows } from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { settingsStyles } from '@/components/settings-ui';
import { FeedCard } from '@/components/social/feed-card';
import { EnterCodeSheet, useInvite } from '@/components/social/follow-actions';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { loadMoreFeed, refreshFeed, useFeed } from '@/lib/feed';
import { useFollowRows, useRefreshFollowsOnFocus } from '@/lib/follows';
import { refreshInbox } from '@/lib/inbox';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The following feed on Home, under the last workout card, drawn only with
 * the social flag (docs/social-spec.md, Home and Feed).
 *
 * - Following nobody yet: the "Train with friends" card. Invite opens the
 *   share sheet (a reported share ticks the setup checklist's Invite a
 *   friend, through `onInvited`), "Have a code?" the Enter invite code sheet, and a tap
 *   anywhere else on the card opens Profile, Following.
 * - Following people: their finished workouts from the last 14 days,
 *   newest first, one FeedCard each, then Show more while there may be
 *   more. Held in lib/feed.ts; filtered against the follow rows, so an
 *   unfollow or a block takes a card away at once.
 *
 * Reads the feed, the follow rows and the inbox's kudos on each focus of
 * Home and each return to the foreground. Every read fails quiet: nothing
 * draws for the feed until its first read lands, and a failed read keeps
 * what is held. Follow requests are in the bell's inbox, not here.
 */
export function FollowingFeedSlot({ onInvited }: { onInvited: () => void }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const rows = useFollowRows(me);
  const feed = useFeed(me);
  // Mounted only with social on, inside Home, so this reads on each focus
  // of Home, including after the invite screen closes over it.
  useRefreshFollowsOnFocus(me);
  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      void refreshFeed(me);
      void refreshInbox(me);
    }, [me]),
  );
  useEffect(() => {
    if (!me) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void refreshFeed(me);
      void refreshInbox(me);
    });
    return () => sub.remove();
  }, [me]);
  const router = useRouter();
  const navHref = useNavHref();
  const { scheme, colors: c } = useTheme();
  const { label: unitLabel, unit: viewerUnit } = useWeightUnit();
  const { invite, busy } = useInvite();
  const codeRef = useRef<SheetRef>(null);

  if (!me || !rows) return null;
  const now = Date.now();
  const lists = splitFollows(rows, me, now);
  const following = new Set(lists.following.map((r) => r.other_id));
  const items = feed.items
    ? filterFeed(feed.items, { me, now, following, blocked: new Set<string>() })
    : null;

  return (
    <View style={styles.slot}>
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
              // A reported share ticks the checklist's Invite a friend,
              // the same rule as the checklist's own button.
              onPress={async () => {
                if (await invite()) onInvited();
              }}
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
      ) : items ? (
        <>
          <Text style={[type.label, styles.heading, { color: c.text3 }]}>Following</Text>
          {items.length === 0 ? (
            <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
              No workouts from people you follow in the last 14 days.
            </Text>
          ) : (
            items.map((item) => (
              <FeedCard
                key={item.workout_id}
                item={item}
                viewerUnit={viewerUnit}
                unitLabel={unitLabel}
                now={now}
                onOpen={() => router.push(navHref({ kind: 'friendWorkout', id: item.workout_id }))}
                onOpenPerson={() => router.push(navHref({ kind: 'person', id: item.user_id }))}
              />
            ))
          )}
          {feed.more ? (
            <Pressable
              onPress={() => void loadMoreFeed(me)}
              disabled={feed.loadingMore}
              accessibilityRole="button"
              accessibilityState={{ busy: feed.loadingMore }}
              style={({ pressed }) => [styles.more, (pressed || feed.loadingMore) && settingsStyles.pressed]}>
              {feed.loadingMore ? (
                <ActivityIndicator />
              ) : (
                <Text style={[type.button, { color: c.accentText }]}>Show more</Text>
              )}
            </Pressable>
          ) : null}
        </>
      ) : null}

      <EnterCodeSheet ref={codeRef} onDone={() => codeRef.current?.dismiss()} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { gap: spacing.md },
  heading: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  empty: { fontSize: 15, paddingHorizontal: spacing.xs },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
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
