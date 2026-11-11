import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { afterBlock, inviteLink, inviteMessage, normalizeInviteCode, type FollowRow } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { handle } from '@/components/social/person-row';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import {
  blockUser,
  endFollow,
  myInviteCode,
  regenerateInviteCode,
  requestFollowUser,
  respondFollow,
} from '@/data/social';
import { refreshFollows, updateFollows } from '@/lib/follows';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The follow actions every social list shares: approve, decline, follow
 * back, withdraw, unfollow, remove follower and block. Each changes the
 * held rows at the tap (lib/follows.ts), calls the server, and reads the
 * rows again either way, so a refusal puts the row back.
 *
 * Report joins the ⋯ menu with the social-safety branch.
 */

const same = (a: Pick<FollowRow, 'follower_id' | 'followee_id'>) => (b: FollowRow) =>
  b.follower_id === a.follower_id && b.followee_id === a.followee_id;

export function useFollowActions() {
  const { session } = useAuth();
  const me = session?.user.id ?? null;

  const run = useCallback(
    async (change: (rows: FollowRow[]) => FollowRow[], call: () => Promise<{ ok: boolean; message?: string }>) => {
      if (!me) return;
      updateFollows(me, change);
      const result = await call();
      if (!result.ok && 'message' in result) Alert.alert('That did not go through', result.message);
      await refreshFollows(me);
    },
    [me],
  );

  const approve = (row: FollowRow) =>
    run(
      (rows) =>
        rows.map((r) => (same(row)(r) ? { ...r, status: 'accepted' as const, accepted_at: new Date().toISOString() } : r)),
      () => respondFollow(row, true),
    );

  // Silent: the sender keeps seeing Requested until it expires.
  const decline = (row: FollowRow) => run((rows) => rows.filter((r) => !same(row)(r)), () => respondFollow(row, false));

  const followBack = (otherId: string) => {
    if (!me) return Promise.resolve();
    const pending: FollowRow = {
      follower_id: me,
      followee_id: otherId,
      other_id: otherId,
      other_username: null,
      status: 'pending',
      requested_by: me,
      created_at: new Date().toISOString(),
      accepted_at: null,
    };
    return run((rows) => [pending, ...rows], () => requestFollowUser(otherId));
  };

  const withdraw = (row: FollowRow) => run((rows) => rows.filter((r) => !same(row)(r)), () => endFollow(row));

  const unfollow = (row: FollowRow) =>
    Alert.alert(`Unfollow ${handle(row.other_username)}?`, 'Following them again takes a new request.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: () => void run((rows) => rows.filter((r) => !same(row)(r)), () => endFollow(row)),
      },
    ]);

  const removeFollower = (row: FollowRow) =>
    Alert.alert(
      `Remove ${handle(row.other_username)}?`,
      "They stop seeing your workouts. They aren't told, and they can ask to follow you again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void run((rows) => rows.filter((r) => !same(row)(r)), () => endFollow(row)),
        },
      ],
    );

  const block = (otherId: string, username: string | null) =>
    Alert.alert(
      `Block ${handle(username)}?`,
      "Follows between you end both ways and neither of you can send a request. They aren't told. Unblock in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            if (!me) return;
            void run((rows) => afterBlock(rows, me, otherId), () => blockUser(otherId));
          },
        },
      ],
    );

  return { me, approve, decline, followBack, withdraw, unfollow, removeFollower, block };
}

export type PersonMenuAction = 'unfollow' | 'remove' | 'block';

/** The ⋯ menu on a Following or Followers row. */
export const PersonMenuSheet = forwardRef<
  SheetRef,
  { username: string | null; kind: 'following' | 'follower'; onAction: (action: PersonMenuAction) => void }
>(function PersonMenuSheet({ username, kind, onAction }, ref) {
  const c = useColors();
  const items: SheetMenuItem<PersonMenuAction>[] = [
    kind === 'following' ? { key: 'unfollow', label: 'Unfollow' } : { key: 'remove', label: 'Remove follower' },
    { key: 'block', label: 'Block', destructive: true },
  ];
  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        {handle(username)}
      </Text>
      <SheetMenu items={items} onSelect={onAction} />
    </Sheet>
  );
});

/**
 * Invite a friend: the share sheet with the user's invite link in the
 * message text, which is where Android looks (it drops `url`). iOS also
 * gets it as `url`, so Messages and Mail show a link preview. Android's
 * chooser is titled "Share your invite link".
 */
export function useInvite() {
  const [busy, setBusy] = useState(false);

  /**
   * True when the share sheet reports a share, the signal Home's setup
   * checklist uses to tick Invite a friend. iOS reports one for any
   * completed target and cannot say whether a message was sent.
   */
  async function invite(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    const code = await myInviteCode();
    setBusy(false);
    if (!code.ok) {
      Alert.alert('Could not make your invite link', code.message);
      return false;
    }
    try {
      const message = inviteMessage(code.data);
      const result = await Share.share(
        Platform.OS === 'ios' ? { message, url: inviteLink(code.data) } : { message },
        // Android's chooser title; iOS has none.
        { dialogTitle: 'Share your invite link' },
      );
      return result.action === Share.sharedAction;
    } catch {
      // Dismissed or failed to open; nothing to undo.
      return false;
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset invite link?',
      'Your current link stops working. Anyone who has not used it yet needs the new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const code = await regenerateInviteCode();
            if (!code.ok) Alert.alert('Could not reset your invite link', code.message);
            else Alert.alert('Invite link reset', 'Share it again from Invite a friend.');
          },
        },
      ],
    );
  }

  return { invite, confirmReset, busy };
}

/**
 * Enter invite code: the fallback when the link was lost on the way
 * through the App Store. A sheet rather than Alert.prompt, which Android
 * does not have. Opens the invite screen for a code that can be one.
 */
export const EnterCodeSheet = forwardRef<SheetRef, { onDone: () => void }>(function EnterCodeSheet({ onDone }, ref) {
  const c = useColors();
  const router = useRouter();
  const [value, setValue] = useState('');
  const code = normalizeInviteCode(value);
  // Set by a Continue that found no code; typing clears it.
  const [tried, setTried] = useState(false);

  function submit() {
    if (!code) {
      setTried(true);
      return;
    }
    setValue('');
    setTried(false);
    onDone();
    router.push({ pathname: '/invite/[code]', params: { code } });
  }

  const showError = tried && !code;

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Enter invite code</Text>
      <BottomSheetTextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={value}
        onChangeText={(v) => {
          setTried(false);
          setValue(v);
        }}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="8 letters and numbers"
        placeholderTextColor={c.text3}
        returnKeyType="go"
        onSubmitEditing={submit}
        style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
      />
      {showError ? (
        <Text style={[type.meta, styles.error, { color: c.danger }]}>
          That is not an invite code. Codes are 8 letters and numbers.
        </Text>
      ) : null}
      <Pressable
        onPress={submit}
        disabled={!value.trim()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.save, { backgroundColor: c.accent }, (pressed || !value.trim()) && styles.pressed]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>Continue</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 20,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  error: { marginTop: -spacing.xs, marginBottom: spacing.md, paddingHorizontal: 4 },
  save: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
