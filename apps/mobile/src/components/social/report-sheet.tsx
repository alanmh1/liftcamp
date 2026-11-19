import {
  afterBlock,
  REPORT_REASONS,
  REPORT_THANKS,
  reportErrorMessage,
  type ReportReason,
} from '@liftcamp/shared';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, SheetMenu, type SheetRef } from '@/components/BottomSheet';
import { handle } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { blockUser, fileReport } from '@/data/social';
import { refreshFollows, updateFollows } from '@/lib/follows';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Report someone (docs/social-v1-spec.md, Branch 2). Opened from the ⋯
 * menu on a feed card, the person screen, a Following or Followers row,
 * and the read-only friend workout.
 *
 * "Report @username", then the four reasons as rows (a list sheet, so the
 * left edge). From a card or a friend workout the report carries the
 * workout; from a person or a row it carries none. Once `file_report`
 * answers, the sheet thanks them and offers "Block @username too", which
 * blocks at once (the tap is the confirmation), and Done. `onBlocked`
 * runs when the sheet closes after a block.
 *
 * Errors show under the rows: the daily limit (54000) in the app's words,
 * anything else as the server said it.
 *
 * Each screen renders its own, like the copy sheet. `open(target)` sets
 * who is reported and presents it.
 */

export type ReportTarget = { userId: string; username: string | null; workoutId: string | null };
export type ReportSheetRef = { open: (target: ReportTarget) => void };

type Phase = 'pick' | 'sending' | 'sent';

export const ReportSheet = forwardRef<ReportSheetRef, { onBlocked?: (userId: string) => void }>(function ReportSheet(
  { onBlocked },
  ref,
) {
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const sheetRef = useRef<SheetRef>(null);
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<'idle' | 'busy' | 'done'>('idle');

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setTarget(next);
        setPhase('pick');
        setError(null);
        setBlock('idle');
        sheetRef.current?.present();
      },
    }),
    [],
  );

  async function send(reason: ReportReason) {
    if (!target || phase !== 'pick') return;
    setPhase('sending');
    setError(null);
    const result = await fileReport({ userId: target.userId, workoutId: target.workoutId, reason });
    if (result.ok) {
      setPhase('sent');
      return;
    }
    setPhase('pick');
    setError(reportErrorMessage(result));
  }

  async function blockToo() {
    if (!target || !me || block !== 'idle') return;
    setBlock('busy');
    updateFollows(me, (rows) => afterBlock(rows, me, target.userId));
    const result = await blockUser(target.userId);
    void refreshFollows(me);
    if (!result.ok) {
      setBlock('idle');
      setError(result.message);
      return;
    }
    setBlock('done');
  }

  // After the sheet closes, so a screen that leaves on a block (the friend
  // workout) does not go while "is blocked" is still showing.
  function closed() {
    if (block === 'done' && target) onBlocked?.(target.userId);
  }

  const name = handle(target?.username ?? null);

  return (
    <Sheet ref={sheetRef} onDismiss={closed}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        Report {name}
      </Text>
      {phase === 'sent' ? (
        <>
          <Text style={[styles.thanks, { color: c.text }]}>{REPORT_THANKS}</Text>
          <Pressable
            onPress={() => void blockToo()}
            disabled={block !== 'idle'}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: c.border },
              (pressed || block === 'busy') && styles.pressed,
            ]}>
            <Text style={[type.button, { color: block === 'done' ? c.text3 : c.danger }]}>
              {block === 'done' ? `${name} is blocked` : block === 'busy' ? 'Blocking…' : `Block ${name} too`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, { backgroundColor: c.accent }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: palettes.light.bg }]}>Done</Text>
          </Pressable>
        </>
      ) : (
        <SheetMenu
          items={REPORT_REASONS.map((r) => ({ key: r.key, label: r.label, disabled: phase === 'sending' }))}
          onSelect={(key) => void send(key)}
        />
      )}
      {error ? (
        <View style={styles.errorRow}>
          <Text style={[type.meta, { color: c.danger }]}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  thanks: { fontSize: 17, lineHeight: 23, paddingHorizontal: 4, paddingBottom: spacing.lg },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  done: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  errorRow: { paddingTop: spacing.md, paddingHorizontal: 4 },
  pressed: { opacity: 0.7 },
});
