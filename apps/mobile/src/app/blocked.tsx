import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ListGroup } from '@/components/settings-ui';
import { handle, PersonRow, RowButton } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { listBlocks, unblockUser, type BlockedUser } from '@/data/social';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Settings, Blocked: everyone the user has blocked, each with Unblock.
 * Unblocking lets requests through again; it does not bring back the
 * follows the block removed.
 */
export default function BlockedScreen() {
  const c = useColors();
  // Null while the first read runs; false when it failed.
  const [blocked, setBlocked] = useState<BlockedUser[] | null | false>(null);

  const load = useCallback(async () => {
    const result = await listBlocks();
    setBlocked(result.ok ? result.data : false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmUnblock(user: BlockedUser) {
    Alert.alert(
      `Unblock ${handle(user.username)}?`,
      'You can send each other requests again. Follows the block removed stay removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBlocked((b) => (b ? b.filter((x) => x.user_id !== user.user_id) : b));
            const result = await unblockUser(user.user_id);
            if (!result.ok) Alert.alert('That did not go through', result.message);
            await load();
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content}>
        {blocked === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : blocked === false ? (
          <Text style={[type.meta, styles.line, { color: c.text2 }]}>
            Could not load the people you blocked. Check your connection and try again.
          </Text>
        ) : blocked.length === 0 ? (
          <Text style={[type.meta, styles.line, { color: c.text2 }]}>
            You haven't blocked anyone. Block someone from the ⋯ menu on your Followers or Following list.
          </Text>
        ) : (
          <ListGroup footer="They aren't told when you block or unblock them.">
            {blocked.map((u) => (
              <PersonRow
                key={u.user_id}
                username={u.username}
                actions={<RowButton label="Unblock" onPress={() => confirmUnblock(u)} />}
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  line: { fontSize: 15, paddingHorizontal: spacing.xs },
});
