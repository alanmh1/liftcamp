import { tidyWeight, type WeightUnit } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { BirthYearSheet, BodyweightSheet } from '@/components/body-sheets';
import { Chip, Section, settingsStyles, ValueRow } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { UsernameSheet } from '@/components/username-sheet';
import {
  ensureUsername,
  getBodyProfile,
  setBirthYear,
  setBodyweight,
  setSex,
  SEX_LABELS,
  SEXES,
  type BodyProfile,
  type Sex,
} from '@/data/home';
import { startFreshAsNewUser } from '@/lib/dev-reset';
import { useTheme, THEME_SETTINGS } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Settings, pushed from the gear on Profile: body fields, units, theme,
 * username, account, and the dev-only reset. Every field saves on change.
 */

const PROVIDER_LABELS: Record<string, string> = { apple: 'Apple', google: 'Google' };

const UNITS: { unit: WeightUnit; label: string }[] = [
  { unit: 'lb', label: 'lbs' },
  { unit: 'kg', label: 'kg' },
];

/**
 * Which third-party identity a signed-in user has. Read from `identities`
 * rather than `app_metadata.provider`, because an account that started
 * anonymous and was linked keeps `anonymous` as its first provider.
 */
function providerLabel(user: { identities?: { provider: string }[] } | undefined): string | null {
  const real = user?.identities?.map((i) => i.provider).filter((p) => p !== 'anonymous') ?? [];
  const labels = real.map((p) => PROVIDER_LABELS[p] ?? p[0].toUpperCase() + p.slice(1));
  return labels.length > 0 ? labels.join(' and ') : null;
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { colors: c, setting, setSetting } = useTheme();
  const { unit, label: unitLabel, setUnit } = useWeightUnit();
  const router = useRouter();
  const userId = session?.user.id;
  const anonymous = !!session?.user.is_anonymous;

  const [body, setBody] = useState<BodyProfile | null>(null);
  const birthYearRef = useRef<SheetRef>(null);
  const bodyweightRef = useRef<SheetRef>(null);
  // Minted here if the account has none yet, the same as the summary does.
  const [username, setUsername] = useState<string | null>(null);
  const usernameRef = useRef<SheetRef>(null);
  useEffect(() => {
    if (!userId) return;
    getBodyProfile(userId).then(setBody);
    ensureUsername(userId, session?.user.email).then(setUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const patchBody = useCallback((next: Partial<BodyProfile>) => {
    setBody((b) => (b ? { ...b, ...next } : b));
  }, []);

  const pickSex = useCallback(
    (sex: Sex) => {
      if (!userId) return;
      patchBody({ sex });
      void setSex(userId, sex);
    },
    [userId, patchBody],
  );

  const pickBirthYear = useCallback(
    (year: number) => {
      if (!userId) return;
      patchBody({ birthYear: year });
      void setBirthYear(userId, year);
    },
    [userId, patchBody],
  );

  const saveBodyweight = useCallback(
    (value: number | null) => {
      if (!userId) return;
      patchBody({ bodyweight: value });
      void setBodyweight(userId, value);
    },
    [userId, patchBody],
  );

  /**
   * Bodyweight is stored in the profile's unit, so it converts in the same
   * write. The chip moves only once that write lands; every screen showing
   * a weight re-renders from the context when it does.
   */
  async function pickUnit(next: WeightUnit) {
    if (next === unit || !body) return;
    const result = await setUnit(next, body.bodyweight);
    if (!result) {
      Alert.alert('Could not change units.', 'Try again.');
      return;
    }
    patchBody({ bodyweight: result.bodyweight, weightUnit: next });
  }

  /** The confirm reads differently for an account that can come back and one that cannot. */
  function confirmStartFresh() {
    const startFresh = { text: 'Start fresh', style: 'destructive' as const, onPress: () => void startFreshAsNewUser() };
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    if (anonymous) {
      Alert.alert(
        'Start fresh as a new user?',
        'This guest account has no email, so its workouts will not be reachable again unless you save an email to it first.',
        [cancel, { text: 'Save with email', onPress: () => router.push('/link-account') }, startFresh],
      );
      return;
    }
    const provider = providerLabel(session?.user);
    const back = session?.user.email
      ? `sign back in any time with a code sent to ${session.user.email}`
      : `sign back in any time with ${provider ?? 'your account'}`;
    Alert.alert('Start fresh as a new user?', `Your account and its workouts are kept. You can ${back}.`, [cancel, startFresh]);
  }

  const bodyweight = body?.bodyweight ?? null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Section title="Body" c={c}>
          <Text style={[type.meta, { color: c.text2 }]}>Sex</Text>
          <View style={settingsStyles.row}>
            {SEXES.map((s) => (
              <Chip
                key={s}
                label={SEX_LABELS[s]}
                selected={body?.sex === s}
                onPress={() => pickSex(s)}
                c={c}
                capitalize={false}
              />
            ))}
          </View>

          <Text style={[type.meta, { color: c.text2 }]}>Birth year</Text>
          <ValueRow
            value={body?.birthYear != null ? String(body.birthYear) : null}
            action={body?.birthYear != null ? 'Edit' : 'Add'}
            onPress={() => birthYearRef.current?.present()}
            accessibilityLabel="Birth year"
            c={c}
          />

          <Text style={[type.meta, { color: c.text2 }]}>Bodyweight</Text>
          <ValueRow
            value={bodyweight != null ? `${tidyWeight(bodyweight, unit)} ${unitLabel}` : null}
            action={bodyweight != null ? 'Edit' : 'Add'}
            onPress={() => bodyweightRef.current?.present()}
            accessibilityLabel="Bodyweight"
            c={c}
          />

          <Text style={[type.meta, { color: c.text2 }]}>
            Used to estimate your strength level. Only you can see this.
          </Text>
        </Section>

        <Section title="Units" c={c}>
          <View style={settingsStyles.row}>
            {UNITS.map((u) => (
              <Chip
                key={u.unit}
                label={u.label}
                selected={unit === u.unit}
                onPress={() => void pickUnit(u.unit)}
                c={c}
                capitalize={false}
              />
            ))}
          </View>
        </Section>

        <Section title="Theme" c={c}>
          <View style={settingsStyles.row}>
            {THEME_SETTINGS.map((s) => (
              <Chip key={s} label={s} selected={setting === s} onPress={() => setSetting(s)} c={c} />
            ))}
          </View>
        </Section>

        <Section title="Username" c={c}>
          <ValueRow
            value={username ? `@${username}` : null}
            action="Edit"
            onPress={() => usernameRef.current?.present()}
            accessibilityLabel="Edit username"
            c={c}
          />
          <Text style={[type.meta, { color: c.text2 }]}>The name on the workout cards you share.</Text>
        </Section>

        <Section title="Account" c={c}>
          {anonymous ? (
            <>
              <Text style={[type.meta, { color: c.text2 }]}>
                Your workouts are saved on this device only. They are not tied to an
                account yet, so a new phone or a reinstall starts from nothing.
              </Text>
              <Pressable
                onPress={() => router.push('/link-account')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: c.accent },
                  pressed && settingsStyles.pressed,
                ]}>
                <Text style={[type.button, { color: '#FFFFFF' }]}>Save your workouts</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.identity}>
              <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>
                {session?.user.email ?? 'Signed in'}
              </Text>
              {providerLabel(session?.user) ? (
                <Text style={[type.meta, { color: c.text2 }]}>
                  Signed in with {providerLabel(session?.user)}
                </Text>
              ) : null}
            </View>
          )}
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.signOut,
              { borderColor: c.border },
              pressed && settingsStyles.pressed,
            ]}>
            <Text style={[type.button, { color: c.danger }]}>Sign out</Text>
          </Pressable>
        </Section>

        {/* Dev builds only. Becomes a brand new anonymous user, the way a
            fresh install would, without touching the old account's rows.
            The alert says what that means for the account in hand. */}
        {__DEV__ ? (
          <Section title="Developer" c={c}>
            <Pressable
              onPress={() => confirmStartFresh()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.signOut,
                { borderColor: c.border },
                pressed && settingsStyles.pressed,
              ]}>
              <Text style={[type.button, { color: c.text }]}>Start fresh as a new user</Text>
            </Pressable>
            <Text style={[type.meta, { color: c.text2 }]}>
              Signs out, forgets everything stored on this phone, signs in as a new guest
              and reloads. The old account and its workouts are not deleted.
            </Text>
          </Section>
        ) : null}
      </ScrollView>

      <BirthYearSheet ref={birthYearRef} current={body?.birthYear ?? null} onPick={pickBirthYear} />
      <BodyweightSheet
        ref={bodyweightRef}
        current={bodyweight == null ? null : tidyWeight(bodyweight, unit)}
        unit={unit}
        label={unitLabel}
        onSave={saveBodyweight}
      />
      <UsernameSheet ref={usernameRef} userId={userId} current={username} onSaved={setUsername} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: 48 },
  identity: { gap: 2 },
  primary: {
    alignSelf: 'flex-start',
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  signOut: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
