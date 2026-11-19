import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COMMUNITY_RULES_URL,
  CONTACT_EMAIL,
  communityRulesKey,
  parseCommunityRulesCache,
} from '@liftcamp/shared';
import * as WebBrowser from 'expo-web-browser';
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, StyleSheet } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { acceptCommunityRules, communityRulesAcceptedAt } from '@/data/social';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * The community rules, agreed to once before the user's first social
 * action: sending an invite, sending or accepting a follow request, or
 * giving kudos (docs/social-v1-spec.md, Branch 2). Reading the feed never
 * asks.
 *
 * `useCommunityRules()` gives `requireRules(action)`. With the rules
 * accepted it runs the action at once. Otherwise it shows the sheet;
 * "I agree" writes `user_profiles.community_rules_accepted_at`, and the
 * action runs once the sheet has closed (so a share sheet the action opens
 * never fights the closing one). Closing without agreeing cancels the
 * action, and `requireRules` resolves undefined.
 *
 * Accepted is cached on the phone per user (`liftcamp:community-rules:<id>`,
 * in memory after the first read), like the social flag. With nothing
 * cached the profile row is asked, so a reinstall does not ask again.
 *
 * One provider at the root, inside BottomSheetModalProvider. A screen in a
 * native modal (the invite screen) renders its own BottomSheetModalProvider
 * and its own CommunityRulesProvider inside it, so the sheet shows over
 * that modal.
 */

type RequireRules = <T>(action: () => T | Promise<T>) => Promise<T | undefined>;

const Ctx = createContext<RequireRules | null>(null);

/** Users this run knows have accepted. Shared by every provider. */
const accepted = new Set<string>();

async function knownAccepted(userId: string): Promise<boolean> {
  if (accepted.has(userId)) return true;
  const raw = await AsyncStorage.getItem(communityRulesKey(userId)).catch(() => null);
  if (parseCommunityRulesCache(raw)) {
    accepted.add(userId);
    return true;
  }
  return false;
}

function remember(userId: string, at: string) {
  accepted.add(userId);
  void AsyncStorage.setItem(communityRulesKey(userId), at).catch(() => {});
}

export function useCommunityRules(): RequireRules {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCommunityRules needs a CommunityRulesProvider');
  return v;
}

type Held = { run: () => unknown; resolve: (value: unknown) => void };

export function CommunityRulesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const sheetRef = useRef<SheetRef>(null);
  const held = useRef<Held | null>(null);
  const agreed = useRef(false);
  const [busy, setBusy] = useState(false);

  // Warm the memory copy, so the first tap does not wait on storage.
  useEffect(() => {
    if (userId) void knownAccepted(userId);
  }, [userId]);

  const requireRules = useCallback<RequireRules>(
    async <T,>(action: () => T | Promise<T>) => {
      if (!userId || (await knownAccepted(userId))) return action();
      const server = await communityRulesAcceptedAt(userId);
      if (server.ok && server.data) {
        remember(userId, server.data);
        return action();
      }
      // A second tap while the sheet is up replaces the first.
      held.current?.resolve(undefined);
      return new Promise<T | undefined>((resolve) => {
        held.current = { run: action, resolve: resolve as (value: unknown) => void };
        agreed.current = false;
        sheetRef.current?.present();
      });
    },
    [userId],
  );

  async function agree() {
    if (!userId || busy) return;
    setBusy(true);
    const at = new Date().toISOString();
    const result = await acceptCommunityRules(userId, at);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('That did not go through', result.message);
      return;
    }
    remember(userId, at);
    agreed.current = true;
    sheetRef.current?.dismiss();
  }

  function onDismiss() {
    const h = held.current;
    held.current = null;
    if (!h) return;
    if (!agreed.current) {
      h.resolve(undefined);
      return;
    }
    agreed.current = false;
    Promise.resolve()
      .then(h.run)
      .then(h.resolve, () => h.resolve(undefined));
  }

  const value = useMemo(() => requireRules, [requireRules]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CommunityRulesSheet ref={sheetRef} busy={busy} onAgree={() => void agree()} onDismiss={onDismiss} />
    </Ctx.Provider>
  );
}

/** Opens the terms' Community rules section in an in-app Safari sheet. */
export function openCommunityRules(): void {
  WebBrowser.openBrowserAsync(COMMUNITY_RULES_URL).catch(() => {
    Linking.openURL(COMMUNITY_RULES_URL).catch(() => {});
  });
}

/** Content only, so centred (apps/mobile/CLAUDE.md, Sheets: alignment). */
const CommunityRulesSheet = forwardRef<SheetRef, { busy: boolean; onAgree: () => void; onDismiss: () => void }>(
  function CommunityRulesSheet({ busy, onAgree, onDismiss }, ref) {
  const c = useColors();
  return (
    <Sheet ref={ref} onDismiss={onDismiss}>
      <Text style={[styles.title, styles.centered, { color: c.text }]}>Before you train with friends</Text>
      <Text style={[styles.body, styles.centered, { color: c.text2 }]}>
        Keep it friendly. No harassment, hate or sexual content in your username, workout names or notes.
      </Text>
      <Text style={[styles.body, styles.centered, { color: c.text2 }]}>
        You can report or block anyone from the ⋯ menu. We review reports within 24 hours and remove what breaks the
        rules.
      </Text>
      <Text style={[styles.body, styles.centered, { color: c.text2 }]}>Questions? {CONTACT_EMAIL}</Text>
      <Pressable
        onPress={openCommunityRules}
        accessibilityRole="link"
        hitSlop={8}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <Text style={[type.button, styles.centered, { color: c.accentText }]}>Read the full terms</Text>
      </Pressable>
      <Pressable
        onPress={onAgree}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.agree, { backgroundColor: c.accent }, (pressed || busy) && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>{busy ? 'Saving…' : 'I agree'}</Text>
      </Pressable>
    </Sheet>
  );
  },
);

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, paddingTop: spacing.sm, paddingBottom: spacing.md },
  body: { fontSize: 15, lineHeight: 21, paddingBottom: spacing.md },
  link: { alignSelf: 'center', paddingVertical: spacing.sm, marginBottom: spacing.md },
  agree: { alignSelf: 'stretch', borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
