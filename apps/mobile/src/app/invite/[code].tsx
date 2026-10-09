import {
  afterInviteRequest,
  inviteScreenState,
  normalizeInviteCode,
  type InvitePreview,
} from '@liftcamp/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { settingsStyles } from '@/components/settings-ui';
import { handle, InitialsAvatar } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { invitePreview, requestFollow, socialAccessNow } from '@/data/social';
import { refreshFollows } from '@/lib/follows';
import { clearPendingInvite } from '@/lib/pending-invite';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * An invite, opened from a link (PendingInviteHandler) or a typed code
 * (Profile, Following, Enter invite code). docs/social-spec.md, Invites.
 *
 * Asks the server whether social is on now (social_access), not the launch
 * latch: a guest who linked on the way here has nothing latched for this
 * run. Without it, "Friends are coming soon" and nothing is sent. With it,
 * the inviter and two buttons:
 * - Follow: a request to the inviter, who approves it.
 * - Let them follow you: a request the other way, which the inviter also
 *   approves, since the caller started it.
 * A tap that meets a request the inviter already sent approves both at
 * once (open_follow), and the button says Following.
 *
 * Signed-up users only; the handler sends a guest to create an account
 * first. The saved invite is cleared once the screen has an answer.
 */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(String(params.code ?? ''));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;

  const [socialOn, setSocialOn] = useState<boolean | null | undefined>(undefined);
  const [preview, setPreview] = useState<InvitePreview[] | null | undefined>(undefined);
  const [sending, setSending] = useState<'follow' | 'let_follow' | null>(null);

  const load = useCallback(async () => {
    setSocialOn(undefined);
    setPreview(undefined);
    if (!code || isGuest) return;
    const on = await socialAccessNow();
    setSocialOn(on.ok ? on.data : null);
    if (!on.ok || !on.data) return;
    const p = await invitePreview(code);
    setPreview(p.ok ? p.data : null);
  }, [code, isGuest]);

  useEffect(() => {
    void load();
  }, [load]);

  const state = !code || isGuest ? ({ kind: 'not-found' } as const) : inviteScreenState({ socialOn, preview });

  // Acted on once there is an answer. A failed read keeps it for a retry.
  // A guest never gets here from the handler; if one does, the invite
  // stays saved for after they sign up.
  useEffect(() => {
    if (isGuest) return;
    if (state.kind === 'coming-soon' || state.kind === 'not-found' || state.kind === 'ready') {
      void clearPendingInvite();
    }
  }, [state.kind, isGuest]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function send(direction: 'follow' | 'let_follow') {
    if (!code || state.kind !== 'ready' || sending) return;
    setSending(direction);
    const result = await requestFollow(code, direction);
    setSending(null);
    if (!result.ok) {
      Alert.alert('That did not go through', result.message);
      return;
    }
    setPreview([afterInviteRequest(state.preview, direction, result.data)]);
    if (userId) void refreshFollows(userId);
  }

  const name = state.kind === 'ready' ? handle(state.preview.username) : '';

  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && settingsStyles.pressed}>
          <Text style={[type.button, { color: c.accentText }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {state.kind === 'loading' ? <ActivityIndicator /> : null}

        {state.kind === 'error' ? (
          <>
            <Text style={[styles.title, { color: c.text }]}>Could not open this invite</Text>
            <Text style={[styles.lead, { color: c.text2 }]}>Check your connection and try again.</Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, { borderColor: c.border }, pressed && settingsStyles.pressed]}>
              <Text style={[type.button, { color: c.text }]}>Try again</Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === 'coming-soon' ? (
          <>
            <Text style={[styles.title, { color: c.text }]}>Friends are coming soon</Text>
            <Text style={[styles.lead, { color: c.text2 }]}>
              Following friends and seeing their workouts isn't open to everyone yet. Your workouts stay private.
            </Text>
          </>
        ) : null}

        {state.kind === 'not-found' ? (
          <>
            <Text style={[styles.title, { color: c.text }]}>This invite doesn't work</Text>
            <Text style={[styles.lead, { color: c.text2 }]}>
              The link may have been reset, or it's your own. Ask your friend to send their link again.
            </Text>
          </>
        ) : null}

        {state.kind === 'ready' ? (
          <>
            <InitialsAvatar username={state.preview.username} size={72} />
            <Text style={[styles.title, { color: c.text }]}>{name}</Text>
            <Text style={[styles.lead, { color: c.text2 }]}>
              invited you to train together on LiftCamp. Each request needs their OK.
            </Text>

            <View style={styles.buttons}>
              <ActionButton
                primary
                label={
                  state.follow === 'following' ? 'Following' : state.follow === 'requested' ? 'Requested' : 'Follow'
                }
                hint="See their workouts"
                busy={sending === 'follow'}
                disabled={state.follow !== 'follow' || sending !== null}
                onPress={() => void send('follow')}
              />
              <ActionButton
                label={
                  state.letFollow === 'following'
                    ? 'They follow you'
                    : state.letFollow === 'offered'
                      ? 'Sent'
                      : 'Let them follow you'
                }
                hint="They see your workouts"
                busy={sending === 'let_follow'}
                disabled={state.letFollow !== 'offer' || sending !== null}
                onPress={() => void send('let_follow')}
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  hint,
  onPress,
  primary = false,
  busy,
  disabled,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  primary?: boolean;
  busy: boolean;
  disabled: boolean;
}) {
  const c = useColors();
  return (
    <View style={styles.action}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityHint={hint}
        accessibilityState={{ disabled, busy }}
        style={({ pressed }) => [
          styles.button,
          primary && !disabled ? { backgroundColor: c.accent } : { borderColor: c.border, borderWidth: 1.5 },
          pressed && settingsStyles.pressed,
        ]}>
        {busy ? (
          <ActivityIndicator color={primary ? '#FFFFFF' : c.text3} />
        ) : (
          <Text style={[type.button, { fontSize: 17, color: primary && !disabled ? '#FFFFFF' : disabled ? c.text2 : c.text }]}>
            {label}
          </Text>
        )}
      </Pressable>
      <Text style={[type.meta, { color: c.text3, textAlign: 'center' }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.screen },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.screen },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.48, textAlign: 'center' },
  lead: { fontSize: 16, textAlign: 'center', maxWidth: 320 },
  buttons: { alignSelf: 'stretch', gap: spacing.lg, marginTop: spacing.xl },
  action: { gap: spacing.xs },
  button: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  secondary: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
});
