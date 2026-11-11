import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  accountEmails,
  isRelayUsername,
  normalizeUsernameInput,
  RELAY_USERNAME_PROBLEM,
  USERNAME_MAX,
  usernameProblem,
} from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import { setUsername, type SetUsernameResult } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Edit the username, from Profile and from the summary screen next to the
 * card that prints it. One component so both places validate the same way.
 *
 * The rules match the database: 3 to 20 characters, lowercase letters,
 * digits and underscore, starting with a letter. Capitals are lowercased as
 * the user types rather than refused, and a taken name is an inline line
 * under the input, the same as a name that is too short. A name made from
 * the account's Apple relay address is refused the same way.
 */
export const UsernameSheet = forwardRef<
  SheetRef,
  {
    userId: string | undefined;
    current: string | null;
    /** Called with the saved name. The parent updates its own state. */
    onSaved: (username: string) => void;
  }
>(function UsernameSheet({ userId, current, onSaved }, ref) {
  const c = useColors();
  const { session } = useAuth();
  const emails = session ? accountEmails(session.user) : [];
  const [value, setValue] = useState(current ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValue(current ?? '');
    setError(null);
  }, [current]);

  const problem =
    value.length === 0
      ? null
      : (usernameProblem(value) ?? (isRelayUsername(value, emails) ? RELAY_USERNAME_PROBLEM : null));
  const unchanged = value === (current ?? '');
  const canSave = !busy && !unchanged && value.length > 0 && problem == null;

  async function save() {
    if (!userId || !canSave) return;
    setBusy(true);
    setError(null);
    const result: SetUsernameResult = await setUsername(userId, value, emails);
    setBusy(false);
    if (result.ok) {
      onSaved(value);
      (ref as React.RefObject<SheetRef | null>).current?.dismiss();
      return;
    }
    setError(
      result.reason === 'taken'
        ? 'That username is taken.'
        : result.reason === 'invalid'
          ? 'Lowercase letters, digits and underscore only.'
          : result.reason === 'relay'
            ? RELAY_USERNAME_PROBLEM
            : 'Could not save that. Try again.',
    );
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Username</Text>
      <View style={[styles.field, { backgroundColor: c.inputFill, borderColor: c.border }]}>
        <Text style={[styles.at, { color: c.text3 }]}>@</Text>
        <BottomSheetTextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          value={value}
          onChangeText={(t) => {
            setValue(normalizeUsernameInput(t));
            setError(null);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          style={[styles.input, { color: c.text }]}
        />
      </View>
      <Text style={[type.meta, styles.hint, { color: error || problem ? c.danger : c.text3 }]}>
        {error ?? problem ?? 'This is the name on the cards you share.'}
      </Text>
      <Pressable
        onPress={() => void save()}
        disabled={!canSave}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: c.accent },
          (pressed || !canSave) && styles.pressed,
        ]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>{busy ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
  },
  at: { fontSize: 17, paddingRight: 2 },
  input: { flex: 1, fontSize: 17, paddingVertical: spacing.md },
  hint: { paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: 4 },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
