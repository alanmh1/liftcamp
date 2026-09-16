import { routineArtByProgram, templateLevelLabel, type TemplateRow } from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { useWeightUnit } from '@/components/unit-provider';
import { LastWorkoutCard } from '@/components/home/last-workout-card';
import { ResumeCard } from '@/components/home/resume-card';
import { RoutineCard } from '@/components/home/routine-card';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { StarterRoutines } from '@/components/home/starter-routines';
import { WeekStrip } from '@/components/home/week-strip';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate, InProgressWorkout, LastWorkout } from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

type HomeData = {
  target: number;
  weekDates: string[];
  inProgress: InProgressWorkout | null;
  finishedCount: number;
  last: LastWorkout | null;
  mine: HomeTemplate[];
  /** All system routines; `starterPrograms` picks from them with the prefs. */
  system: TemplateRow[];
  prefs: home.TrainingPrefs;
};

/**
 * Relaunching mid-workout opens the workout, not Home. Module-level so it
 * fires once per app process rather than once per Home mount, and keyed by
 * user so a session switch mid-process behaves like a launch for the new
 * user rather than inheriting the old one's flag.
 */
const autoResumedFor = new Set<string>();

function firstName(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.full_name ?? meta?.name ?? meta?.given_name;
  if (typeof raw !== 'string') return null;
  const first = raw.trim().split(/\s+/)[0];
  return first && first.length <= 24 ? first : null;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const c = useColors();
  const userId = session?.user.id;

  const [data, setData] = useState<HomeData | null>(null);
  // One key for anything that starts a workout: a routine id, 'empty', or
  // 'repeat'. Any non-null value disables every other start control on the
  // screen.
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<InProgressWorkout | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuRef = useRef<SheetRef>(null);
  const renameRef = useRef<SheetRef>(null);
  const [menuTemplate, setMenuTemplate] = useState<HomeTemplate | null>(null);

  const { label: unit } = useWeightUnit();

  const load = useCallback(async () => {
    if (!userId) return;
    const [target, weekDates, inProgress, finishedCount, last, mine, system, prefs] = await Promise.all([
      home.getWeeklyTarget(userId),
      home.getWeekWorkoutDates(userId),
      home.getInProgressWorkout(userId),
      home.getFinishedWorkoutCount(userId),
      home.getLastWorkout(userId),
      home.getUserTemplates(userId),
      home.getSystemTemplates(),
      home.getTrainingPrefs(userId),
    ]);
    setData({ target, weekDates, inProgress, finishedCount, last, mine, system, prefs });

    if (inProgress && !autoResumedFor.has(userId)) {
      autoResumedFor.add(userId);
      router.push({ pathname: '/workout/[id]', params: { id: inProgress.id } });
    }
  }, [userId, router]);

  // Everything reads on focus, so returning from a workout refreshes the strip
  // and the last-workout card without a pull to refresh.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openWorkout(id: string) {
    router.push({ pathname: '/workout/[id]', params: { id } });
  }

  async function run(key: string, fn: () => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    const id = await fn();
    setBusy(null);
    if (id) openWorkout(id);
    else Alert.alert('Could not start that workout.', 'Try again.');
  }

  function discard(w: InProgressWorkout) {
    setData((d) => (d ? { ...d, inProgress: null } : d));
    setUndo(w);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      // Only delete once the undo window closes, so undo is a pure UI revert.
      void home.discardWorkout(w.id);
      setUndo(null);
    }, 5000);
  }

  function undoDiscard() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setData((d) => (d && undo ? { ...d, inProgress: undo } : d));
    setUndo(null);
  }

  async function onRoutineAction(action: RoutineAction) {
    menuRef.current?.dismiss();
    const t = menuTemplate;
    if (!t || !userId) return;
    if (action === 'rename') {
      renameRef.current?.present();
      return;
    }
    if (action === 'duplicate') {
      await home.saveTemplateCopy(userId, t);
      await load();
      return;
    }
    if (action === 'share') {
      const url = await home.ensureShareLink(t.id);
      if (url) await Share.share({ message: `${t.name}: a routine on LiftCamp\n${url}`, url });
      return;
    }
    if (action === 'delete') {
      Alert.alert(`Delete ${t.name}?`, 'This removes the routine, not any logged workouts.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await home.deleteTemplate(t.id);
            await load();
          },
        },
      ]);
    }
  }

  async function onRename(name: string) {
    renameRef.current?.dismiss();
    if (!menuTemplate) return;
    await home.renameTemplate(menuTemplate.id, name);
    await load();
  }

  if (!data) {
    return <View style={[styles.fill, { backgroundColor: c.bg }]} />;
  }

  const isNew = data.finishedCount === 0;
  const art = useMemo(() => routineArtByProgram(data.system), [data.system]);
  const name = firstName(session?.user.user_metadata as Record<string, unknown> | undefined);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {name ? <Text style={[type.meta, { color: c.text2 }]}>Hi {name}</Text> : null}

        <WeekStrip
          dates={data.weekDates}
          target={data.target}
          onPress={() => router.navigate('/history')}
        />

        {data.inProgress ? (
          <ResumeCard
            workout={data.inProgress}
            onResume={() => openWorkout(data.inProgress!.id)}
            onDiscard={() => discard(data.inProgress!)}
          />
        ) : null}

        <Pressable
          onPress={() => void run('empty', () => startAdHocWorkout(userId!))}
          disabled={busy !== null}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: c.accent },
            (pressed || busy === 'empty') && styles.pressed,
          ]}>
          <Text style={[type.button, styles.startLabel]}>
            {busy === 'empty' ? 'Starting…' : 'Start empty workout'}
          </Text>
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[type.exerciseName, { color: c.text }]}>Routines</Text>
            <Pressable onPress={() => router.push('/routines')} hitSlop={8}>
              <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
            </Pressable>
          </View>

          {/* Your routines. A saved routine's variations sit under a heading
              with its name; a routine with no program is a card on its own. */}
          {home.groupUserTemplates(data.mine).map((g) => (
            <View key={g.key} style={styles.routineGroup}>
              {g.program ? (
                <Text style={[type.meta, styles.routineHeading, { color: c.text2 }]} numberOfLines={1}>
                  {g.program}
                  {templateLevelLabel(g.level) ? `  ·  ${templateLevelLabel(g.level)}` : ''}
                </Text>
              ) : null}
              {g.templates.map((t) => (
                <RoutineCard
                  key={t.id}
                  template={t}
                  lastDone={t.lastDone}
                  primaryLabel="Start"
                  onPrimary={() => void run(t.id, () => home.startFromTemplate(userId!, t))}
                  onLongPress={() => {
                    setMenuTemplate(t);
                    menuRef.current?.present();
                  }}
                  busy={busy === t.id}
                  disabled={busy !== null}
                />
              ))}
            </View>
          ))}

          <StarterRoutines
            match={home.starterPrograms(data.system, data.prefs)}
            art={art}
            prefs={data.prefs}
            onSeeAll={() => router.push({ pathname: '/routines', params: { all: '1' } })}
            defaultOpen={isNew}
            disabled={busy !== null}
            onUse={async (g) => {
              if (!userId) return false;
              const ok = await home.saveProgramCopy(userId, g);
              if (ok) await load();
              return ok;
            }}
          />
        </View>

        {session?.user.is_anonymous ? (
          // Anonymous accounts only. Opens sign-in in link mode; once an
          // identity is attached the user stops being anonymous and this row
          // goes away on its own.
          <Pressable
            onPress={() => router.push('/link-account')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveRow,
              { backgroundColor: c.accentSoft },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>Save your workouts</Text>
            <Text style={[type.meta, { color: c.text2 }]}>
              Add Apple or Google and keep them on your next phone
            </Text>
          </Pressable>
        ) : null}

        {data.last ? (
          <LastWorkoutCard
            workout={data.last}
            unit={unit}
            onOpen={() => router.push({ pathname: '/history/[id]', params: { id: data.last!.id } })}
            onRepeat={() => void run('repeat', () => home.repeatWorkout(userId!, data.last!))}
            busy={busy === 'repeat'}
          />
        ) : null}
      </ScrollView>

      {undo ? (
        <View style={[styles.toast, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <Text style={[type.meta, { color: c.text }]}>Workout discarded</Text>
          <Pressable onPress={undoDiscard} hitSlop={8}>
            <Text style={[type.button, { color: c.accentText }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <RoutineMenuSheet ref={menuRef} template={menuTemplate} onAction={(a) => void onRoutineAction(a)} />
      <RenameSheet ref={renameRef} initialName={menuTemplate?.name ?? ''} onSave={(n) => void onRename(n)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
    paddingBottom: 48,
  },
  start: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startLabel: { color: '#FFFFFF', fontSize: 17 },
  section: { gap: spacing.md },
  routineGroup: { gap: spacing.sm },
  routineHeading: { fontWeight: '600' },
  saveRow: {
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toast: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.8 },
});
