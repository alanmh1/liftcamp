import {
  deleteAccountConfirmation,
  NOT_DELETED_TITLE,
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  formatBirthday,
  tidyWeight,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type TrainingLevel,
  type WeightUnit,
} from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { BirthdaySheet, BodyweightSheet } from '@/components/body-sheets';
import { ChoiceSheet } from '@/components/choice-sheet';
import { useOnboarding } from '@/components/onboarding-provider';
import { ListAction, ListGroup, ListRow, Section, settingsStyles } from '@/components/settings-ui';
import { SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { UsernameSheet } from '@/components/username-sheet';
import {
  ensureUsername,
  getBodyProfile,
  getTrainingPrefs,
  getWeeklyTarget,
  setBirthday,
  setBodyweight,
  setSex,
  setTrainingPrefs,
  setWeeklyTarget,
  SEX_LABELS,
  SEXES,
  WEEKLY_TARGET_OPTIONS,
  type BodyProfile,
  type Sex,
  type TrainingPrefs,
} from '@/data/home';
import { chooseOption } from '@/lib/action-sheet';
import {
  clearDeviceAfterDeletion,
  deleteAccount,
  hasAppleIdentity,
  type DeleteOutcome,
} from '@/lib/delete-account';
import { startFreshAsNewUser } from '@/lib/dev-reset';
import { useDevProgression } from '@/lib/pro';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { usePendingMerge } from '@/lib/use-pending-merge';
import { useSyncStatus } from '@/lib/use-sync-status';
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

/** Long enough for Apple's sign-in sheet to finish closing before an alert. */
const ALERT_AFTER_SHEET_MS = 600;

const GUEST_FOOTER =
  "Guests can log one workout. Create a free account to keep training. Everything you've logged comes with you.";

const APPEARANCE_LABELS: Record<ThemeSetting, string> = { light: 'Light', dark: 'Dark', auto: 'Auto' };

const TARGET_OPTIONS = WEEKLY_TARGET_OPTIONS.map((n) => ({ label: String(n), value: n }));
const LEVEL_OPTIONS = TRAINING_LEVELS.map((l) => ({ label: TRAINING_LEVEL_LABELS[l], value: l }));
const EQUIPMENT_OPTIONS = EQUIPMENT_ACCESS.map((e) => ({ label: EQUIPMENT_ACCESS_LABELS[e], value: e }));

/**
 * Which third-party identity a signed-in user has, read from `identities`.
 * An anonymous user has no identity rows, so an account that started as a
 * guest and was linked lists only what it linked. The `anonymous` filter
 * below is a guard, not a case that occurs.
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
  const sync = useSyncStatus();
  const { startOver } = useOnboarding();
  const { colors: c, setting, setSetting } = useTheme();
  const { unit, label: unitLabel, setUnit, loading: unitLoading } = useWeightUnit();
  const router = useRouter();
  const [devProgression, setDevProgression] = useDevProgression();
  const user = session?.user;
  const userId = user?.id;
  const anonymous = !!user?.is_anonymous;
  const merge = usePendingMerge(userId);

  const [body, setBody] = useState<BodyProfile | null>(null);
  const birthdayRef = useRef<SheetRef>(null);
  const bodyweightRef = useRef<SheetRef>(null);
  // Minted here if the account has none yet, the same as the summary does.
  // Undefined until that read returns; null when there is none.
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const usernameRef = useRef<SheetRef>(null);
  // Training: the weekly target Home's week strip counts against, and the
  // two answers that pick Home's starter routines.
  const [target, setTarget] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<TrainingPrefs | null>(null);
  const targetRef = useRef<SheetRef>(null);
  const levelRef = useRef<SheetRef>(null);
  const equipmentRef = useRef<SheetRef>(null);
  useEffect(() => {
    if (!userId) return;
    getBodyProfile(userId).then(setBody);
    getWeeklyTarget(userId).then(setTarget);
    getTrainingPrefs(userId).then(setPrefs);
    ensureUsername(userId).then(setUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const pickTarget = useCallback(
    (n: number) => {
      if (!userId) return;
      setTarget(n);
      void setWeeklyTarget(userId, n);
    },
    [userId],
  );

  // There is no way back to "not answered", since that state only means
  // the question was never asked.
  const pickPrefs = useCallback(
    (next: Partial<TrainingPrefs>) => {
      if (!userId) return;
      setPrefs((p) => ({ level: null, equipment: null, ...p, ...next }));
      void setTrainingPrefs(userId, next);
    },
    [userId],
  );

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

  const [deleting, setDeleting] = useState(false);
  // Why the last delete did not go through, shown under the button until
  // the next attempt.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Confirm, then delete on the server, then clear the device. On success
   * the root holds on its spinner while the device is cleared and lands on
   * onboarding, and this screen unmounts with the rest of the signed-in
   * stack, so nothing here runs after `startOver`.
   */
  function confirmDelete() {
    if (!user || deleting) return;
    const { title, message } = deleteAccountConfirmation({ anonymous, apple: hasAppleIdentity(user) });
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void runDelete() },
    ]);
  }

  /**
   * Every attempt ends in one of three ways: deleted (onboarding), closed
   * Apple's sheet (nothing to say), or "Your account was not deleted",
   * shown both under the button and as an alert. The footer is the one
   * that cannot be missed: iOS drops an alert presented while Apple's sheet
   * is still closing, so the alert also waits `ALERT_AFTER_SHEET_MS`.
   */
  async function runDelete() {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    let outcome: DeleteOutcome;
    try {
      outcome = await deleteAccount(user);
    } catch {
      outcome = { ok: false, cancelled: false, error: 'Something went wrong. Try again.' };
    }
    if (outcome.ok) {
      await startOver(clearDeviceAfterDeletion, 'deleted');
      return;
    }
    setDeleting(false);
    if (outcome.cancelled) return;
    const message = outcome.error;
    setDeleteError(message);
    setTimeout(() => Alert.alert(NOT_DELETED_TITLE, message), ALERT_AFTER_SHEET_MS);
  }

  const bodyweight = body?.bodyweight ?? null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} {...scrollInsetProps}>
        <View style={styles.identity}>
          <Avatar meta={user?.user_metadata} username={username ?? null} size={72} guest={anonymous} />
          {username === undefined ? (
            <SkeletonText variant={type.exerciseName} width={120} />
          ) : username ? (
            <Text style={[type.exerciseName, { color: c.text }]}>@{username}</Text>
          ) : null}
        </View>

        <ListGroup title="Training" footer="Experience and equipment choose the starter routines on Home.">
          <ListRow
            label="Weekly target"
            value={target != null ? `${target} a week` : null}
            loading={target == null}
            onPress={() => targetRef.current?.present()}
          />
          <ListRow
            label="Experience"
            value={prefs?.level ? TRAINING_LEVEL_LABELS[prefs.level] : null}
            loading={prefs == null}
            onPress={() => levelRef.current?.present()}
          />
          <ListRow
            label="Equipment"
            value={prefs?.equipment ? EQUIPMENT_ACCESS_LABELS[prefs.equipment] : null}
            loading={prefs == null}
            onPress={() => equipmentRef.current?.present()}
          />
        </ListGroup>

        <ListGroup title="About you" footer="Private. Used for your strength level.">
          <ListRow
            label="Sex"
            value={body?.sex ? SEX_LABELS[body.sex] : null}
            loading={body == null}
            onPress={pickSex}
          />
          <ListRow
            label="Birthday"
            value={formatBirthday(body?.birthday)}
            loading={body == null}
            onPress={() => birthdayRef.current?.present()}
          />
          <ListRow
            label="Bodyweight"
            value={bodyweight != null ? `${tidyWeight(bodyweight, unit)} ${unitLabel}` : null}
            loading={body == null}
            onPress={() => bodyweightRef.current?.present()}
          />
        </ListGroup>

        <ListGroup title="Preferences">
          <ListRow label="Weight unit" value={unitLabel} loading={unitLoading} onPress={pickUnit} />
          <ListRow label="Appearance" value={APPEARANCE_LABELS[setting]} onPress={pickAppearance} />
        </ListGroup>

        <ListGroup title="Account" footer={anonymous ? GUEST_FOOTER : undefined}>
          <ListRow
            label="Username"
            value={username ? `@${username}` : null}
            loading={username === undefined}
            onPress={() => usernameRef.current?.present()}
          />
          {anonymous ? (
            <ListAction
              label="Create a free account"
              color={c.accentText}
              onPress={() => router.push('/link-account')}
              chevron
            />
          ) : (
            <ListRow label="Signed in with" value={signedInWith(user)} />
          )}
        </ListGroup>

        {/* Only when the server has refused a queued write for good (see
            data/write-queue.ts). Each one is also logged to app_events. */}
        {sync.failed > 0 ? (
          <ListGroup title="Sync" footer="The server refused these changes. They are kept on this phone.">
            <ListRow label="Changes not saved" value={String(sync.failed)} />
          </ListGroup>
        ) : null}

        {/* A guest's workouts not yet moved into the account they signed in
            to (lib/guest-merge.ts). Tried again on launch and foreground too. */}
        {merge.pending ? (
          <ListGroup
            title="Guest workouts"
            footer={
              merge.pending.stuck
                ? "They're kept on this phone. If trying again does not work, write to hello@liftcamp.app."
                : "They're kept on this phone and will be added when LiftCamp reaches the server."
            }>
            <ListRow label="Not added yet" value="Try again" onPress={merge.retry} loading={merge.retrying} />
          </ListGroup>
        ) : null}

        {/* Not for guests: signing out of an anonymous account leaves no
            way back into it, so its workouts would be stranded. */}
        {anonymous ? null : (
          <ListGroup>
            <ListAction label="Sign out" color={c.text} onPress={signOut} centered />
          </ListGroup>
        )}

        <ListGroup
          footer={
            deleteError
              ? `${NOT_DELETED_TITLE}. ${deleteError}`
              : `Deletes ${anonymous ? 'this guest account' : 'your account'} and every workout on it. This cannot be undone.`
          }
          footerColor={deleteError ? c.danger : undefined}>
          <ListAction label="Delete account" color={c.danger} onPress={confirmDelete} busy={deleting} centered />
        </ListGroup>

        {/* Dev builds only. Start fresh becomes a brand new anonymous user,
            the way a fresh install would, without touching the old
            account's rows. The alert says what that means for the account
            in hand. The gallery draws the Home week card in every state. */}
        {__DEV__ ? (
          <Section title="Developer" c={c}>
            <Pressable
              onPress={() => router.push('/dev/week-card')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.devButton,
                { borderColor: c.border },
                pressed && settingsStyles.pressed,
              ]}>
              <Text style={[type.button, { color: c.text }]}>Week card gallery</Text>
            </Pressable>
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
            <View style={styles.devToggle}>
              <Text style={[type.button, styles.devToggleLabel, { color: c.text }]}>Preview Pro progression</Text>
              <Switch
                value={devProgression}
                onValueChange={setDevProgression}
                trackColor={{ true: c.accent }}
                accessibilityLabel="Preview Pro progression"
              />
            </View>
            <Text style={[type.meta, { color: c.text2 }]}>
              Stands in for Pro in dev builds only. Release, preview and production builds never
              show progression until there is a real Pro check.
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
      <ChoiceSheet
        ref={targetRef}
        title="Weekly target"
        options={TARGET_OPTIONS}
        selected={target}
        onPick={(v) => pickTarget(v as number)}
        numeral
        hint="Workouts per week."
      />
      <ChoiceSheet
        ref={levelRef}
        title="Experience"
        options={LEVEL_OPTIONS}
        selected={prefs?.level ?? null}
        onPick={(v) => pickPrefs({ level: v as TrainingLevel })}
      />
      <ChoiceSheet
        ref={equipmentRef}
        title="Equipment"
        options={EQUIPMENT_OPTIONS}
        selected={prefs?.equipment ?? null}
        onPick={(v) => pickPrefs({ equipment: v as EquipmentAccess })}
      />
      <UsernameSheet ref={usernameRef} userId={userId} current={username ?? null} onSaved={setUsername} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  identity: { alignItems: 'center', gap: spacing.sm },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  devToggleLabel: {
    flex: 1,
  },
  devButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
