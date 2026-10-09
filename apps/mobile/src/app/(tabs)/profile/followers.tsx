import { showFollowBack, splitFollows, type FollowRow } from '@liftcamp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { ListGroup } from '@/components/settings-ui';
import { PersonMenuSheet, useFollowActions } from '@/components/social/follow-actions';
import { PersonRow, RowButton } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { refreshFollows, useFollowRows } from '@/lib/follows';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useSocialOn } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Profile, Followers: requests waiting on me at the top (approve or
 * decline; decline is silent), then the people who follow me, each with a
 * ⋯ menu (Remove follower, Block). Approving a request to follow me shows
 * Follow back while I neither follow nor have asked to follow them.
 */
export default function FollowersScreen() {
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const socialOn = useSocialOn() === true;
  const rows = useFollowRows(socialOn ? me : null);
  const actions = useFollowActions();
  const [refreshing, setRefreshing] = useState(false);
  const menuRef = useRef<SheetRef>(null);
  const [menuRow, setMenuRow] = useState<FollowRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (socialOn && me) void refreshFollows(me);
    }, [socialOn, me]),
  );

  async function refresh() {
    if (!me) return;
    setRefreshing(true);
    await refreshFollows(me);
    setRefreshing(false);
  }

  const now = Date.now();
  const lists = rows && me ? splitFollows(rows, me, now) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        {...scrollInsetProps}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {!socialOn ? (
          <Text style={[type.meta, { color: c.text2 }]}>Friends are coming soon.</Text>
        ) : !lists ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <>
            {lists.requests.length > 0 ? (
              <ListGroup title="Requests">
                {lists.requests.map((r) => (
                  <PersonRow
                    key={`${r.follower_id}:${r.followee_id}`}
                    username={r.other_username}
                    detail={r.follower_id === me ? 'Offered to let you follow them' : 'Wants to follow you'}
                    actions={
                      <View style={styles.actions}>
                        <RowButton label="Decline" onPress={() => void actions.decline(r)} />
                        <RowButton label="Approve" primary onPress={() => void actions.approve(r)} />
                      </View>
                    }
                  />
                ))}
              </ListGroup>
            ) : null}

            {lists.followers.length > 0 ? (
              <ListGroup title="Followers">
                {lists.followers.map((r) => (
                  <PersonRow
                    key={`${r.follower_id}:${r.followee_id}`}
                    username={r.other_username}
                    actions={
                      me && showFollowBack(rows!, me, r.other_id, now) ? (
                        <RowButton label="Follow back" primary onPress={() => void actions.followBack(r.other_id)} />
                      ) : undefined
                    }
                    onMenu={() => {
                      setMenuRow(r);
                      menuRef.current?.present();
                    }}
                  />
                ))}
              </ListGroup>
            ) : lists.requests.length === 0 ? (
              <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
                No followers yet. Share your invite link from Following, and approve each request here.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <PersonMenuSheet
        ref={menuRef}
        username={menuRow?.other_username ?? null}
        kind="follower"
        onAction={(action) => {
          menuRef.current?.dismiss();
          if (!menuRow) return;
          if (action === 'remove') actions.removeFollower(menuRow);
          else if (action === 'block') actions.block(menuRow.other_id, menuRow.other_username);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: { fontSize: 15, paddingHorizontal: spacing.xs },
});
