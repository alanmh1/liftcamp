import { inboxLine, showFollowBack, timeAgo, type FollowRow, type InboxItem } from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ListGroup } from '@/components/settings-ui';
import { useFollowActions } from '@/components/social/follow-actions';
import { PersonRow, RowButton } from '@/components/social/person-row';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { refreshFollows, useFollowRows } from '@/lib/follows';
import { markInboxSeen, refreshInbox, useInbox } from '@/lib/inbox';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useSocialOn } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

const keyOf = (r: Pick<FollowRow, 'follower_id' | 'followee_id'>) => `${r.follower_id}:${r.followee_id}`;

/**
 * The inbox behind Home's bell (docs/social-spec.md, Notifications).
 * Follow requests waiting on the user at the top, with Approve and Decline
 * inline (decline is silent), then kudos and comments on the user's
 * workouts and accepted follows, newest first. Built from the follow rows,
 * social_kudos_inbox() and social_comment_inbox(); no notifications table,
 * no push. A comment opens that workout's comments.
 *
 * Opening it marks everything in it seen on this device, and so does
 * leaving it, so whatever arrived while it was open does not light the dot.
 * An approved request stays in place with Follow back while that applies.
 */
export function InboxView() {
  const c = useColors();
  const router = useRouter();
  const navHref = useNavHref();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const socialOn = useSocialOn() === true;
  const user = socialOn ? me : null;
  const rows = useFollowRows(user);
  const { inbox, kudosLoaded } = useInbox(user);
  const actions = useFollowActions();
  const [refreshing, setRefreshing] = useState(false);
  // Requests approved here this visit, kept in place for Follow back.
  const [approved, setApproved] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      markInboxSeen(user);
      void refreshInbox(user);
      void refreshFollows(user);
      return () => markInboxSeen(user);
    }, [user]),
  );

  async function refresh() {
    if (!user) return;
    setRefreshing(true);
    await Promise.all([refreshInbox(user), refreshFollows(user)]);
    setRefreshing(false);
  }

  const now = Date.now();
  const openPerson = (id: string) => router.push(navHref({ kind: 'person', id }));
  const approvedRows = (rows ?? []).filter((r) => r.status === 'accepted' && approved.includes(keyOf(r)));

  function activityRow(item: InboxItem) {
    if (item.kind === 'request') return null;
    const line = inboxLine(item, me ?? '');
    const when = timeAgo(item.at, now);
    if (item.kind === 'accepted') {
      return (
        <PersonRow
          key={item.key}
          username={item.row.other_username}
          userId={item.row.other_id}
          detail={`${line} · ${when}`}
          onPress={() => openPerson(item.row.other_id)}
        />
      );
    }
    if (item.kind === 'comment') {
      return (
        <PersonRow
          key={item.key}
          username={item.username}
          userId={item.userId}
          detail={`${line} · ${when}`}
          onPress={() => router.push(navHref({ kind: 'comments', id: item.workoutId, name: item.workoutName }))}
          pressHint="Opens the comments"
        />
      );
    }
    return (
      <PersonRow
        key={item.key}
        username={item.people[0]?.username ?? null}
        userId={item.people[0]?.userId ?? null}
        detail={`${line} · ${when}`}
        onPress={() => router.push(navHref({ kind: 'workout', id: item.workoutId }))}
        pressHint="Opens your workout"
      />
    );
  }

  return (
    <ScrollView
      {...scrollInsetProps}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {!socialOn ? (
        <Text style={[type.meta, styles.empty, { color: c.text2 }]}>Friends are coming soon.</Text>
      ) : !inbox ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <>
          {inbox.requests.length > 0 || approvedRows.length > 0 ? (
            <ListGroup title="Requests">
              {inbox.requests.map((item) =>
                item.kind === 'request' ? (
                  <PersonRow
                    key={item.key}
                    username={item.row.other_username}
                    userId={item.row.other_id}
                    detail={item.row.follower_id === me ? 'Offered to let you follow them' : 'Wants to follow you'}
                    onPress={() => openPerson(item.row.other_id)}
                    actions={
                      <View style={styles.actions}>
                        <RowButton label="Decline" onPress={() => void actions.decline(item.row)} />
                        <RowButton
                          label="Approve"
                          primary
                          onPress={() => {
                            setApproved((keys) => [...keys, keyOf(item.row)]);
                            void actions.approve(item.row);
                          }}
                        />
                      </View>
                    }
                  />
                ) : null,
              )}
              {approvedRows.map((r) => (
                <PersonRow
                  key={`approved:${keyOf(r)}`}
                  username={r.other_username}
                  userId={r.other_id}
                  detail={r.follower_id === me ? 'You follow them now' : 'Now follows you'}
                  onPress={() => openPerson(r.other_id)}
                  actions={
                    me && rows && showFollowBack(rows, me, r.other_id, now) ? (
                      <RowButton label="Follow back" primary onPress={() => void actions.followBack(r.other_id)} />
                    ) : undefined
                  }
                />
              ))}
            </ListGroup>
          ) : null}

          {inbox.activity.length > 0 ? (
            <ListGroup title="Activity">{inbox.activity.map(activityRow)}</ListGroup>
          ) : inbox.requests.length === 0 && approvedRows.length === 0 && kudosLoaded ? (
            <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
              Nothing yet. Kudos and comments on your workouts and follow requests show up here.
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: { fontSize: 15, paddingHorizontal: spacing.xs },
});
