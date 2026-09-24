import { formatBirthday, tidyWeight, type WeightUnit } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { BirthdaySheet, BodyweightSheet } from '@/components/body-sheets';
import { ListAction, ListGroup, ListRow, Section, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { UsernameSheet } from '@/components/username-sheet';
import {
  ensureUsername,
  getBodyProfile,
  setBirthday,
  setBodyweight,
  setSex,
  SEX_LABELS,
  SEXES,
  type BodyProfile,
  type Sex,
} from '@/data/home';
import { chooseOption } from '@/lib/action-sheet';
import { startFreshAsNewUser } from '@/lib/dev-reset';
import { useTheme, THEME_SETTINGS, type ThemeSetting } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Settings, pushed from the gear on Profile. One row per field, the label
 * on the left and the current value on the right in the accent; tapping
 * the row opens its picker. Every field saves as soon as it is picked.
 */

const PROVIDER_LABELS: Record<string, string> = { apple: 'Apple', google: 'Google' };

const UNITS: { label: string; value: WeightUnit }[] = [
  { label: 'lbs', value: 'lb' },
  { label: 'kg', value: 'kg' },
];

const APPEARANCE_LABELS: Record<ThemeSetting, string> = { light: 'Light', dark: 'Dark', auto: 'Auto' };

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

/**
 * The "Signed in with" value: Apple or Google when the account has one,
 * else the email it signs in with by code.
 */
function signedInWith(user: { identities?: { provider: string }[]; email?: string } | undefined): string {
  const social = (user?.identities ?? [])
    .map((i) => i.provider)
    .filter((p) => p in PROVIDER_LABELS)
    .map((p) => PROVIDER_LABELS[p]);
  if (social.length > 0) return social.join(' and ');
  return user?.email ?? 'Email';
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { colors: c, setting, setSetting } = useTheme();
  const { unit, label: unitLabel, setUnit } = useWeightUnit();
  const router = useRouter();
  const user = session?.user;
  const userId = user?.id;
  const anonymous = !!user?.is_anonymous;

  const [body, setBody] = useState<BodyProfile | null>(null);
  const birthdayRef = useRef<SheetRef>(null);
  const bodyweightRef = useRef<SheetRef>(null);
  // Minted here if the account has none yet, the same as the summary does.
  const [username, setUsername] = useState<string | null>(null);
  const usernameRef = useRef<SheetRef>(null);
  useEffect(() => {
    if (!userId) return;
    getBodyProfile(userId).then(setBody);
    ensureUsername(userId, user?.email).then(setUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const patchBody = useCallback((next: Partial<BodyProfile>) => {
    setBody((b) => (b ? { ...b, ...next } : b));
  }, []);

  function pickSex() {
    chooseOption(
      SEXES.map((s) => ({ label: SEX_LABELS[s], value: s })),
      (sex: Sex) => {
        if (!userId) return;
        patchBody({ sex });
        void setSex(userId, sex);
      },
    );
  }

  const saveBirthday = useCallback(
    (iso: string) => {
      if (!userId) return;
      patchBody({ birthday: iso });
      void setBirthday(userId, iso);
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
   * write. The row changes only once that write lands; every screen showing
   * a weight re-renders from the context when it does.
   */
  function pickUnit() {
    chooseOption(UNITS, async (next) => {
      if (next === unit || !body) return;
      const result = await setUnit(next, body.bodyweight);
      if (!result) {
        Alert.alert('Could not change units.', 'Try again.');
        return;
      }
      patchBody({ bodyweight: result.bodyweight, weightUnit: next });
    });
  }

  function pickAppearance() {
    chooseOption(
      THEME_SETTINGS.map((s) => ({ label: APPEARANCE_LABELS[s], value: s })),
      setSetting,
    );
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
    const provider = providerLabel(user);
    const back = user?.email
      ? `sign back in any time with a code sent to ${user.email}`
      : `sign back in any time with ${provider ?? 'your account'}`;
    Alert.alert('Start fresh as a new user?', `Your account and its workouts are kept. You can ${back}.`, [cancel, startFresh]);
  }

  const bodyweight = body?.bodyweight ?? null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.identity}>
          <Avatar meta={user?.user_metadata} username={username} size={72} />
          {username ? <Text style={[type.exerciseName, { color: c.text }]}>@{username}</Text> : null}
        </View>

        <ListGroup title="About you" footer="Private. Used for your strength level.">
          <ListRow label="Sex" value={body?.sex ? SEX_LABELS[body.sex] : null} onPress={pickSex} />
          <ListRow
            label="Birthday"
            value={formatBirthday(body?.birthday)}
            onPress={() => birthdayRef.current?.present()}
          />
          <ListRow
            label="Bodyweight"
            value={bodyweight != null ? `${tidyWeight(bodyweight, unit)} ${unitLabel}` : null}
            onPress={() => bodyweightRef.current?.present()}
          />
        </ListGroup>

        <ListGroup title="Preferences">
          <ListRow label="Weight unit" value={unitLabel} onPress={pickUnit} />
          <ListRow label="Appearance" value={APPEARANCE_LABELS[setting]} onPress={pickAppearance} />
        </ListGroup>

        <ListGroup title="Account">
          <ListRow
            label="Username"
            value={username ? `@${username}` : null}
            onPress={() => usernameRef.current?.present()}
          />
          {anonymous ? null : <ListRow label="Signed in with" value={signedInWith(user)} />}
        </ListGroup>

        {anonymous ? (
          <View style={styles.guest}>
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
          </View>
        ) : null}

        <ListGroup>
          <ListAction label="Sign out" color={c.danger} onPress={signOut} />
        </ListGroup>

        {/* Dev builds only. Becomes a brand new anonymous user, the way a
            fresh install would, without touching the old account's rows.
            The alert says what that means for the account in hand. */}
        {__DEV__ ? (
          <Section title="Developer" c={c}>
            <Pressable
              onPress={() => confirmStartFresh()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.devButton,
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

      <BirthdaySheet ref={birthdayRef} current={body?.birthday ?? null} onSave={saveBirthday} />
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
  identity: { alignItems: 'center', gap: spacing.sm },
  guest: { gap: spacing.sm },
  primary: {
    alignSelf: 'flex-start',
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  devButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
