import {
  likedBy,
  socialHandle,
  timeAgo,
  viewAllCommentsLine,
  type KudosState,
  type Liker,
  type RecentComment,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { InitialsAvatar } from '@/components/social/person-row';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { refreshCardComments, useCommentCount, useRecentComments } from '@/lib/comments';
import { useKudos } from '@/lib/kudos';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

/** The "Liked by" avatars, and the ring that keeps them apart where they overlap. */
const LIKER_AVATAR = 20;
const RING = 2;
/** A comment's avatar, and the "Add a comment" row's. */
const COMMENT_AVATAR = 28;

/**
 * Likes and comments under a feed card's kudos row, and under the friend
 * workout's (docs/social-feed-inline.sql). Drawn only with a mutual follow;
 * the host keeps the mutual-only line otherwise. Top to bottom:
 *
 * 1. "Liked by", with up to 3 overlapping avatars (the viewer's first when
 *    they gave kudos), from the kudos state as drawn, so a tap on the
 *    thumb changes it at once. Hidden with no kudos.
 * 2. "View all N comments", past the 2 shown.
 * 3. The latest 2 comments: avatar, @username, time ago, the body cut at
 *    3 lines.
 * 4. "Add a comment…" beside the viewer's own sign-in photo, as on Profile.
 *
 * Every comment line opens the comments screen; the last opens it with the
 * composer focused. The community rules gate is the composer's, on send.
 * Back from there, the card reads its workout again through social_workout
 * (`refreshOnReturn`, lib/comments.ts) for its comments and count. The
 * friend workout reads the whole workout on focus anyway, so it turns that
 * off.
 */
export function FeedInline({
  workoutId,
  workoutName,
  kudos,
  likers,
  recentComments,
  commentCount,
  ringColor,
  refreshOnReturn = true,
}: {
  workoutId: string;
  workoutName: string | null;
  /** The read's kudos state; the drawn one comes from lib/kudos.ts. */
  kudos: KudosState;
  likers: Liker[];
  recentComments: RecentComment[];
  commentCount: number;
  /** The background the avatars sit on, for the ring between them. */
  ringColor: string;
  refreshOnReturn?: boolean;
}) {
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const meta = session?.user.user_metadata;
  const state = useKudos(me, workoutId, kudos);
  const count = useCommentCount(me, workoutId, commentCount);
  const comments = useRecentComments(me, workoutId, recentComments);
  const liked = likedBy(state, likers);
  const viewAll = viewAllCommentsLine(count);

  const openComments = useOpenComments(workoutId, workoutName, refreshOnReturn);
  const now = Date.now();
  const ring = { borderWidth: RING, borderColor: ringColor, borderRadius: (LIKER_AVATAR + RING * 2) / 2 };

  return (
    <View style={styles.block}>
      {liked ? (
        <View style={styles.liked} accessible accessibilityLabel={liked.label}>
          <View style={styles.likerAvatars}>
            {liked.you ? (
              <View style={ring}>
                <Avatar meta={meta} username={null} size={LIKER_AVATAR} />
              </View>
            ) : null}
            {liked.avatars.map((p, i) => (
              <View key={p.user_id} style={[ring, (liked.you || i > 0) && styles.overlap]}>
                <InitialsAvatar username={p.username} userId={p.user_id} size={LIKER_AVATAR} />
              </View>
            ))}
          </View>
          <Text style={[styles.likedText, { color: c.text }]} numberOfLines={1}>
            {liked.parts.map((part, i) =>
              part.bold ? (
                <Text key={i} style={styles.bold}>
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
        </View>
      ) : null}

      {viewAll ? (
        <Pressable
          onPress={() => openComments()}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityHint="Opens the comments"
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[styles.muted, { color: c.text2 }]}>{viewAll}</Text>
        </Pressable>
      ) : null}

      {comments.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => openComments()}
          accessibilityRole="button"
          accessibilityLabel={`${socialHandle(row.username)}, ${timeAgo(row.created_at, now)}, ${row.body}`}
          accessibilityHint="Opens the comments"
          style={({ pressed }) => [styles.comment, pressed && styles.pressed]}>
          {row.mine ? (
            <Avatar meta={meta} username={row.username} size={COMMENT_AVATAR} />
          ) : (
            <InitialsAvatar username={row.username} userId={row.user_id} size={COMMENT_AVATAR} />
          )}
          <View style={styles.commentText}>
            <View style={styles.commentHead}>
              <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
                {socialHandle(row.username)}
              </Text>
              <Text style={[styles.ago, { color: c.text2 }]}>{timeAgo(row.created_at, now)}</Text>
            </View>
            <Text style={[styles.body, { color: c.text }]} numberOfLines={3} ellipsizeMode="tail">
              {row.body}
            </Text>
          </View>
        </Pressable>
      ))}

      <Pressable
        onPress={() => openComments(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a comment"
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <Avatar meta={meta} username={null} size={COMMENT_AVATAR} />
        <Text style={[styles.placeholder, { color: c.text3 }]}>Add a comment…</Text>
      </Pressable>
    </View>
  );
}

/**
 * Opens a workout's comments in the stack it is in, `focus` with the
 * composer focused. With `refreshOnReturn`, the first focus back after
 * that reads the workout again through social_workout for the card's
 * latest comments and count (lib/comments.ts). Shared by the comment
 * bubble and the inline block.
 */
export function useOpenComments(
  workoutId: string,
  workoutName: string | null,
  refreshOnReturn: boolean,
): (focus?: boolean) => void {
  const router = useRouter();
  const navHref = useNavHref();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  // Set when this opens the comments, so only that return reads again.
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!opened.current) return;
      opened.current = false;
      if (refreshOnReturn && me) void refreshCardComments(me, workoutId);
    }, [refreshOnReturn, me, workoutId]),
  );
  return useCallback(
    (focus = false) => {
      opened.current = true;
      router.push(navHref({ kind: 'comments', id: workoutId, name: workoutName, focus }));
    },
    [router, navHref, workoutId, workoutName],
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  liked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  likerAvatars: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -8 },
  likedText: { flexShrink: 1, fontSize: 14, fontWeight: '400' },
  bold: { fontWeight: '600' },
  muted: { fontSize: 14, fontWeight: '400' },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  commentText: { flex: 1, gap: 2 },
  commentHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  username: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  ago: { fontSize: 13, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 19 },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  placeholder: { fontSize: 14, fontWeight: '400' },
  pressed: { opacity: 0.6 },
});
