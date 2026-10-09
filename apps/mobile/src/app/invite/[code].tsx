import {
  afterInviteRequest,
  inviteAction,
  inviteScreenState,
  normalizeInviteCode,
  type InvitePreview,
} from '@liftcamp/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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
 * the inviter, one Follow button and "Let them follow you too" under it,
 * checked by default (inviteAction in shared):
 * - Checked, one tap sends both: a request to follow the inviter, and an
 *   offer to let them follow back. The inviter approves each.
 * - Unchecked, only the follow. The button then offers the other one.
 * A request that meets one the inviter already sent approves both at once
 * (open_follow), and the button says Following.
 *
 * Close at the top right on every state, the same on iOS and Android.
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

  // "Let them follow you too", checked by default.
  const [alsoLetFollow, setAlsoLetFollow] = useState(true);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!code || state.kind !== 'ready' || sending) return;
    const { sends } = inviteAction(state.follow, state.letFollow, alsoLetFollow);
    if (sends.length === 0) return;
    setSending(true);
    let next = state.preview;
    // In order, so the follow goes first. A refusal stops there and says
    // why; what already went through stays shown.
    for (const direction of sends) {
      const result = await requestFollow(code, direction);
      if (!result.ok) {
        Alert.alert('That did not go through', result.message);
        break;
      }
      next = afterInviteRequest(next, direction, result.data);
    }
    setSending(false);
    setPreview([next]);
    if (userId) void refreshFollows(userId);
  }

  const name = state.kind === 'ready' ? handle(state.preview.username) : '';
  const action = state.kind === 'ready' ? inviteAction(state.follow, state.letFollow, alsoLetFollow) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.close, { backgroundColor: c.surface2 }, pressed && settingsStyles.pressed]}>
          <Text style={[type.button, { color: c.text }]}>Close</Text>
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

        {state.kind === 'ready' && action ? (
          <>
            <InitialsAvatar username={state.preview.username} size={72} />
            <Text style={[styles.title, { color: c.text }]}>{name}</Text>
            <Text style={[styles.lead, { color: c.text2 }]}>
              invited you to train together on LiftCamp. Each request needs their OK.
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => void send()}
                disabled={action.sends.length === 0 || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: action.sends.length === 0, busy: sending }}
                style={({ pressed }) => [
                  styles.button,
                  action.sends.length > 0
                    ? { backgroundColor: c.accent }
                    : { borderColor: c.border, borderWidth: 1.5 },
                  pressed && settingsStyles.pressed,
                ]}>
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[type.button, { fontSize: 17, color: action.sends.length > 0 ? '#FFFFFF' : c.text2 }]}>
                    {action.label}
                  </Text>
                )}
              </Pressable>

              {action.checkbox ? (
                <Pressable
                  onPress={() => setAlsoLetFollow((v) => !v)}
                  disabled={sending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: alsoLetFollow, disabled: sending }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.checkRow, pressed && settingsStyles.pressed]}>
                  <SymbolView
                    name={
                      alsoLetFollow
                        ? { ios: 'checkmark.square.fill', android: 'check_box' }
                        : { ios: 'square', android: 'check_box_outline_blank' }
                    }
                    size={24}
                    tintColor={alsoLetFollow ? c.accent : c.text3}
                    fallback={<Text style={{ color: c.accent, fontSize: 20 }}>{alsoLetFollow ? '☑' : '☐'}</Text>}
                  />
                  <Text style={[styles.checkLabel, { color: c.text }]}>Let them follow you too</Text>
                </Pressable>
              ) : action.note ? (
                <Text style={[type.meta, styles.note, { color: c.text2 }]}>{action.note}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.screen },
  close: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.screen },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.48, textAlign: 'center' },
  lead: { fontSize: 16, textAlign: 'center', maxWidth: 320 },
  actions: { alignSelf: 'stretch', gap: spacing.lg, marginTop: spacing.xl },
  button: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44 },
  checkLabel: { fontSize: 16 },
  note: { fontSize: 15, textAlign: 'center' },
  secondary: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
});
