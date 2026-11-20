import {
  afterBlock,
  COMMENT_MAX,
  commentActions,
  commentErrorMessage,
  commentToSend,
  socialHandle,
  timeAgo,
  withoutAuthor,
  type CommentAction,
  type CommentRow,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { useCommunityRules } from '@/components/social/community-rules-sheet';
import { handle, InitialsAvatar } from '@/components/social/person-row';
import { ReportSheet, type ReportSheetRef } from '@/components/social/report-sheet';
import { useNavHref } from '@/components/tab-layout';
import { Text, TextInput } from '@/components/text';
import { addComment, blockUser, deleteComment, workoutComments } from '@/data/social';
import { chooseOption } from '@/lib/action-sheet';
import { setCommentCount } from '@/lib/comments';
import { refreshFollows, updateFollows } from '@/lib/follows';
import { useSocialOn } from '@/lib/social-access';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useKeyboard } from '@/lib/use-keyboard';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const AVATAR = 32;
/** The character count shows once this few are left. */
const COUNT_FROM = 50;

/**
 * A workout's comments (docs/social-v2-spec.md, Branch 3). Pushed in the
 * Home, Workout and Profile stacks from the bubble on a feed card or the
 * friend workout, the Comments row on the user's own workout, and a
 * comment in the inbox. The title is the workout's name when the link
 * knew it.
 *
 * Oldest first, as workout_comments() returns them: avatar, @username,
 * time ago and the body. The avatar and name open the person. ⋯ on a
 * comment: someone else's gets Report (the report sheet, with the comment)
 * and Block; Delete joins them on the user's own workout. The user's own
 * comment gets Delete. Delete and Block confirm first.
 *
 * The composer is pinned under the list, above the keyboard: up to 500
 * characters and a send button. The first comment asks for the community
 * rules, like any first social action. A refused send keeps the text and
 * says why under the field: the blocklist (23514) and the rate limit
 * (54000) in the app's words, anything else as the server said it.
 *
 * Opened from a card's "Add a comment…" row (`focus=1`), the composer
 * takes focus once the push has finished, so the keyboard comes up.
 *
 * Online only. Read on each focus and on pull to refresh. Every read, send
 * and delete hands the count to lib/comments.ts, so the card and the
 * friend workout behind show it on Back.
 */
export function CommentsView() {
  return (
    // Its own safe-area context, so the bottom inset is this screen's: the
    // tab bar and the home indicator, whichever this stack sits above.
    <SafeAreaProvider>
      <CommentsScreen />
    </SafeAreaProvider>
  );
}

function CommentsScreen() {
  const { id, name, focus } = useLocalSearchParams<{ id: string; name?: string; focus?: string }>();
  const navigation = useNavigation();
  const inputRef = useRef<RNTextInput>(null);
  const router = useRouter();
  const navHref = useNavHref();
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const socialOn = useSocialOn() === true;
  const requireRules = useCommunityRules();
  const reportRef = useRef<ReportSheetRef>(null);
  const listRef = useRef<FlatList<CommentRow>>(null);
  const rootRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();

  // Undefined while the first read is out, null when it failed with nothing held.
  const [comments, setComments] = useState<CommentRow[] | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Scroll to the newest once the list has drawn it.
  const scrollPending = useRef(true);

  const show = useCallback(
    (rows: CommentRow[]) => {
      setComments(rows);
      if (me && id) setCommentCount(me, id, rows.length);
    },
    [me, id],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    const result = await workoutComments(id);
    if (result.ok) show(result.data);
    else setComments((held) => held ?? null);
  }, [id, show]);

  useFocusEffect(
    useCallback(() => {
      if (socialOn) void load();
    }, [socialOn, load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // How much of this screen the keyboard covers, measured: the screen's
  // bottom edge against the keyboard's top. Whether the screen runs under
  // the tab bar or stops above it, the composer lands on the keyboard.
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    if (keyboard.top == null || keyboard.height <= 0) {
      setCovered(0);
      return;
    }
    const top = keyboard.top;
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      setCovered(Math.max(0, Math.round(y + h - top)));
    });
    scrollPending.current = true;
  }, [keyboard.top, keyboard.height]);

  // "Add a comment…": focus the composer once, after the push lands, so
  // the keyboard does not ride in with the screen. The timer covers a
  // stack that sends no transitionEnd.
  const focused = useRef(false);
  useEffect(() => {
    if (focus !== '1' || !socialOn) return;
    const go = () => {
      if (focused.current) return;
      focused.current = true;
      inputRef.current?.focus();
    };
    const unsubscribe = navigation.addListener('transitionEnd' as never, go);
    const timer = setTimeout(go, 600);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [focus, socialOn, navigation]);

  async function send() {
    const body = commentToSend(draft);
    if (!id || !body || sending) return;
    setSending(true);
    setError(null);
    const result = await addComment(id, body);
    if (!result.ok) {
      setSending(false);
      setError(commentErrorMessage(result));
      return;
    }
    setDraft('');
    scrollPending.current = true;
    await load();
    setSending(false);
  }

  function confirmDelete(row: CommentRow) {
    Alert.alert('Delete this comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (comments) show(comments.filter((r) => r.id !== row.id));
            const result = await deleteComment(row.id);
            if (!result.ok) Alert.alert('That did not go through', result.message);
            await load();
          })();
        },
      },
    ]);
  }

  function confirmBlock(row: CommentRow) {
    Alert.alert(
      `Block ${handle(row.username)}?`,
      "Follows between you end both ways and neither of you can send a request. They aren't told. Unblock in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            if (!me) return;
            void (async () => {
              updateFollows(me, (rows) => afterBlock(rows, me, row.user_id));
              if (comments) show(withoutAuthor(comments, row.user_id));
              const result = await blockUser(row.user_id);
              if (!result.ok) Alert.alert('That did not go through', result.message);
              await Promise.all([refreshFollows(me), load()]);
            })();
          },
        },
      ],
    );
  }

  function openMenu(row: CommentRow) {
    const labels: Record<CommentAction, string> = { report: 'Report', block: 'Block', delete: 'Delete' };
    chooseOption(
      commentActions(row).map((a) => ({ label: labels[a], value: a, destructive: a !== 'report' })),
      (action) => {
        if (action === 'delete') confirmDelete(row);
        else if (action === 'block') confirmBlock(row);
        else reportRef.current?.open({ userId: row.user_id, username: row.username, workoutId: id ?? null, commentId: row.id });
      },
    );
  }

  const title = name?.trim() || 'Comments';
  const now = Date.now();
  const canSend = commentToSend(draft) != null && !sending;
  const left = COMMENT_MAX - draft.length;

  return (
    <View ref={rootRef} style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title }} />
      {!socialOn ? (
        <Text style={[type.meta, styles.line, { color: c.text2 }]}>Friends are coming soon.</Text>
      ) : (
        <>
          <FlatList
            ref={listRef}
            {...scrollInsetProps}
            style={styles.fill}
            data={comments ?? []}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            onContentSizeChange={() => {
              if (!scrollPending.current || !comments || comments.length === 0) return;
              scrollPending.current = false;
              listRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              comments === undefined ? (
                <ActivityIndicator style={styles.loading} />
              ) : (
                <Text style={[type.meta, styles.line, { color: c.text2 }]}>
                  {comments === null ? 'Could not load comments. Pull down to try again.' : 'No comments yet.'}
                </Text>
              )
            }
            renderItem={({ item }) => (
              <CommentItem
                row={item}
                now={now}
                onOpenPerson={item.mine ? undefined : () => router.push(navHref({ kind: 'person', id: item.user_id }))}
                onMenu={() => openMenu(item)}
              />
            )}
          />

          <View
            style={[
              styles.composer,
              { borderColor: c.divider, backgroundColor: c.bg, paddingBottom: (covered > 0 ? covered : insets.bottom) + spacing.sm },
            ]}>
            {error ? <Text style={[type.meta, styles.error, { color: c.danger }]}>{error}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  if (error) setError(null);
                }}
                placeholder="Add a comment"
                placeholderTextColor={c.text3}
                multiline
                maxLength={COMMENT_MAX}
                editable={!sending}
                accessibilityLabel="Comment"
                style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
              />
              <Pressable
                onPress={() => void requireRules(send)}
                disabled={!canSend}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                accessibilityState={{ disabled: !canSend, busy: sending }}
                style={({ pressed }) => [styles.send, pressed && styles.pressed]}>
                {sending ? (
                  <ActivityIndicator />
                ) : (
                  <SymbolView
                    name={{ ios: 'arrow.up.circle.fill', android: 'send' }}
                    size={32}
                    tintColor={canSend ? c.accent : c.text3}
                    fallback={<Text style={[type.button, { color: canSend ? c.accentText : c.text3 }]}>Send</Text>}
                  />
                )}
              </Pressable>
            </View>
            {left <= COUNT_FROM ? (
              <Text style={[type.meta, styles.count, { color: left <= 0 ? c.danger : c.text3 }]}>{left} left</Text>
            ) : null}
          </View>
        </>
      )}
      <ReportSheet ref={reportRef} onBlocked={() => void load()} />
    </View>
  );
}

function CommentItem({
  row,
  now,
  onOpenPerson,
  onMenu,
}: {
  row: CommentRow;
  now: number;
  /** Omitted for the user's own comment. */
  onOpenPerson?: () => void;
  onMenu: () => void;
}) {
  const c = useColors();
  const who = socialHandle(row.username);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpenPerson}
        disabled={!onOpenPerson}
        accessibilityRole={onOpenPerson ? 'button' : undefined}
        accessibilityLabel={who}
        accessibilityHint={onOpenPerson ? 'Opens their profile' : undefined}
        style={({ pressed }) => pressed && styles.pressed}>
        <InitialsAvatar username={row.username} userId={row.user_id} size={AVATAR} />
      </Pressable>
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Pressable onPress={onOpenPerson} disabled={!onOpenPerson} style={styles.nameWrap}>
            <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
              {who}
            </Text>
          </Pressable>
          <Text style={[type.meta, { color: c.text2 }]}>{timeAgo(row.created_at, now)}</Text>
          <Pressable
            onPress={onMenu}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More for this comment"
            accessibilityHint={row.mine ? 'Delete' : row.can_delete ? 'Report, block or delete' : 'Report or block'}
            style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'ellipsis', android: 'more_horiz' }}
              size={18}
              tintColor={c.text2}
              fallback={<Text style={{ color: c.text2, fontSize: 16 }}>⋯</Text>}
            />
          </Pressable>
        </View>
        <Text selectable style={[styles.body, { color: c.text }]}>
          {row.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING / 2, flexGrow: 1 },
  loading: { marginTop: spacing.xl },
  line: { fontSize: 15, padding: spacing.screen },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameWrap: { flexShrink: 1 },
  username: { fontSize: 15, fontWeight: '600' },
  menu: { marginLeft: 'auto', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 15, lineHeight: 21 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  error: { paddingHorizontal: spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  count: { alignSelf: 'flex-end', paddingRight: 48 },
  pressed: { opacity: 0.6 },
});
