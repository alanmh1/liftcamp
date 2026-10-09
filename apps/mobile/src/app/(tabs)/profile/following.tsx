import { splitFollows, type FollowRow } from '@liftcamp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { ListAction, ListGroup } from '@/components/settings-ui';
import { EnterCodeSheet, PersonMenuSheet, useFollowActions, useInvite } from '@/components/social/follow-actions';
import { PersonRow, RowButton } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { refreshFollows, useFollowRows } from '@/lib/follows';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useSocialOn } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Profile, Following: the invite actions (Invite a friend, Enter invite
 * code, Reset invite link), then requests I sent that are still waiting
 * (Withdraw), then the people I follow, each with a ⋯ menu (Unfollow,
 * Block).
 */
export default function FollowingScreen() {
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const socialOn = useSocialOn() === true;
  const rows = useFollowRows(socialOn ? me : null);
  const actions = useFollowActions();
  const { invite, confirmReset, busy } = useInvite();
  const [refreshing, setRefreshing] = useState(false);
  const menuRef = useRef<SheetRef>(null);
  const codeRef = useRef<SheetRef>(null);
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

  const lists = rows && me ? splitFollows(rows, me, Date.now()) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        {...scrollInsetProps}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {!socialOn ? (
          <Text style={[type.meta, { color: c.text2 }]}>Friends are coming soon.</Text>
        ) : (
          <>
            <ListGroup footer="Anyone with your link can ask to follow you. You approve each request.">
              <ListAction label="Invite a friend" color={c.accentText} onPress={() => void invite()} busy={busy} />
              <ListAction
                label="Enter invite code"
                color={c.text}
                onPress={() => codeRef.current?.present()}
                chevron
              />
            </ListGroup>

            {!lists ? (
              <ActivityIndicator style={styles.loading} />
            ) : (
              <>
                {lists.sent.length > 0 ? (
                  <ListGroup title="Sent" footer="Requests they have not answered go after 30 days.">
                    {lists.sent.map((r) => (
                      <PersonRow
                        key={`${r.follower_id}:${r.followee_id}`}
                        username={r.other_username}
                        detail={r.follower_id === me ? 'Requested to follow' : 'Offered to let them follow you'}
                        actions={<RowButton label="Withdraw" onPress={() => void actions.withdraw(r)} />}
                      />
                    ))}
                  </ListGroup>
                ) : null}

                {lists.following.length > 0 ? (
                  <ListGroup title="Following">
                    {lists.following.map((r) => (
                      <PersonRow
                        key={`${r.follower_id}:${r.followee_id}`}
                        username={r.other_username}
                        onMenu={() => {
                          setMenuRow(r);
                          menuRef.current?.present();
                        }}
                      />
                    ))}
                  </ListGroup>
                ) : lists.sent.length === 0 ? (
                  <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
                    You don't follow anyone yet. Send a friend your invite link, or enter the code from theirs.
                  </Text>
                ) : null}
              </>
            )}

            <ListGroup footer="Makes a new link. The old one stops working.">
              <ListAction label="Reset invite link" color={c.danger} onPress={confirmReset} centered />
            </ListGroup>
          </>
        )}
      </ScrollView>

      <PersonMenuSheet
        ref={menuRef}
        username={menuRow?.other_username ?? null}
        kind="following"
        onAction={(action) => {
          menuRef.current?.dismiss();
          if (!menuRow) return;
          if (action === 'unfollow') actions.unfollow(menuRow);
          else if (action === 'block') actions.block(menuRow.other_id, menuRow.other_username);
        }}
      />
      <EnterCodeSheet ref={codeRef} onDone={() => codeRef.current?.dismiss()} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.md },
  empty: { fontSize: 15, paddingHorizontal: spacing.xs },
});
