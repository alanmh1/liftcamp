import {
  comparisonParts,
  isoFromLocalDate,
  pickVolumeComparison,
  medalRungsThrough,
  mondayOf,
  STRIP_WEEKS,
  streakShare,
  weekCardLine,
  workoutMedal,
  weekCardState,
  weekIndex,
  type StreakShare,
  type StripWeek,
  type WeekCardState,
} from '@liftcamp/shared';
import { Redirect } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StreakCard } from '@/components/home/streak-card';
import { StreakShareSheet, type StreakShareHandle } from '@/components/home/streak-share-sheet';
import { WeekCardView, type WeekCardHandle } from '@/components/home/week-card';
import { Medal } from '@/components/medals/medal';
import type { CardData } from '@/components/summary/share-card';
import { MedalEarnedLine, SummaryCarousel, summaryPages } from '@/components/summary/summary-carousel';
import { Chip, Section } from '@/components/settings-ui';
import { CARD_SIZE } from '@/components/summary/share-card';
import { Text } from '@/components/text';
import { scrollInsetProps } from '@/lib/scroll-insets';
import { ThemeOverride, useTheme } from '@/theme/theme-provider';
import { palettes, radius, spacing, tabular, type, type ColorScheme } from '@/theme/tokens';

/**
 * Dev builds only: the Home week card in every state, drawn from fake
 * dates through the real rules in packages/shared week-card.ts. No
 * Supabase, no stored flags. Reached from Settings → Developer; a
 * production build redirects to Home.
 *
 * Each card gets a `today` inside the week shown, so the phase, the day
 * dots and the at-risk rule all see the day the case needs. The stepper
 * moves that week, which moves each pool's pick, since lines rotate by
 * week.
 *
 * The streak share card closes the page at a few lengths, with made-up
 * strips (fakeShare), drawn at about the width the Home sheet previews it. The chips, and the Share button a
 * medal case shows after Replay celebration, open that sheet here too.
 *
 * The medal week slot cases show the medal in the plates' slot at a
 * narrow and a full slot, beside a plain hit week for the height, and at
 * three digits. The share cards cover both layouts: the medal hero on
 * every rung and 156, the number hero off the ladder.
 *
 * The summary cases run fake histories through workoutMedal, the rule the
 * summary uses, and build their pages with summaryPages, as the summary
 * does: a workout that earns the 2, 26 and 156 medals gets its three
 * workout cards (stats, exercises, comparison) then the medal card, four in
 * all, and the earned line; a normal one keeps its three.
 *
 * The medals section draws every rung through five years (156 and 208
 * reuse the 104 art), earned, locked and in the share card's variant on
 * plate blue, at the sizes the app uses. The streak
 * chip cases include 78 and 104, so the card's medal and its landing can
 * be judged past a year.
 */

const TARGETS = [2, 3, 4, 5, 6];
const STREAK_CHIPS = [1, 2, 4, 8, 12, 26, 52, 78, 104];
/** Every rung plus 156 (the medal layout), and four off the ladder (the number layout). */
const SHARE_CARDS = [1, 3, 13, 60, 2, 4, 8, 12, 26, 52, 78, 104, 156];
/** Every rung through five years. */
const RUNGS = medalRungsThrough(260);
/** The sizes the app draws medals at: the cabinet, then Profile's row and the week card. */
const MEDAL_SIZES = [96, 56];

/** Training days a week in the fake strips, varied so the columns can be judged. */
const FAKE_DAYS = [3, 4, 2, 5, 3, 6, 4, 7, 3, 5, 1, 4];

/**
 * A made-up streak share of `weeks`: hit weeks cycling through FAKE_DAYS,
 * and from 8 weeks one rest week four weeks back, so the dash shows. The
 * real ones come from streakShare over workout dates. 60 is here for the
 * 🦾 line past a year, off a medal rung.
 */
function fakeShare(weeks: number): StreakShare {
  const span: StripWeek[] = Array.from({ length: weeks }, (_, i) => ({
    rest: false as const,
    days: FAKE_DAYS[i % FAKE_DAYS.length],
  }));
  if (weeks >= 8) span.splice(weeks - 4, 0, { rest: true });
  const workouts = span.reduce((n, w) => n + (w.rest ? 0 : w.days), 0);
  return { weeks, strip: span.slice(-STRIP_WEEKS), workouts };
}
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Case = {
  key: string;
  caption: string;
  target: number;
  dates: string[];
  /** Lifetime finished workouts. 0 is the first-workout phase. */
  finishedCount: number;
  /** Monday 0 to Sunday 6, in the week shown. */
  weekday: number;
  replay?: boolean;
};

type Built = Case & { state: WeekCardState; line: string; today: Date };

/** Builds dates relative to the Monday of the week shown. */
function calendar(monday: Date) {
  const at = (week: number, weekday: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + week * 7 + weekday);
    return d;
  };
  const day = (week: number, weekday: number) => isoFromLocalDate(at(week, weekday));
  /** The first `n` days of this week. */
  const thisWeek = (n: number) => Array.from({ length: n }, (_, i) => day(0, i));
  /** `count` hit weeks ending `endsAgo` weeks back, `target` days each. */
  const hitWeeks = (count: number, target: number, endsAgo = 1) =>
    Array.from({ length: count }, (_, w) => Array.from({ length: target }, (_, i) => day(-(endsAgo + w), i))).flat();
  return { at, day, thisWeek, hitWeeks };
}

function countCases(target: number, cal: ReturnType<typeof calendar>): Case[] {
  const base = { target, finishedCount: 20 };
  const cases: Case[] = [
    { ...base, key: `t${target}-zero-early`, caption: '0 done, Tuesday', dates: [], weekday: 1 },
    { ...base, key: `t${target}-zero-late`, caption: '0 done, Friday', dates: [], weekday: 4 },
  ];
  for (let k = 1; k < target; k += 1) {
    cases.push({
      ...base,
      key: `t${target}-done-${k}`,
      caption: `${k} done, ${DAY_NAMES[k]}${target - k === 1 ? ', one left' : ''}`,
      dates: cal.thisWeek(k),
      weekday: k,
    });
  }
  cases.push({
    ...base,
    key: `t${target}-hit`,
    caption: `Target hit, ${DAY_NAMES[target - 1]}, trained today`,
    dates: cal.thisWeek(target),
    weekday: target - 1,
    replay: true,
  });
  cases.push({
    ...base,
    key: `t${target}-over`,
    caption: `Over target, ${target + 1} done, ${DAY_NAMES[target]}`,
    dates: cal.thisWeek(target + 1),
    weekday: target,
  });
  return cases;
}

function extraCases(cal: ReturnType<typeof calendar>): { title: string; cases: Case[] }[] {
  const target = 3;
  const base = { target, finishedCount: 20 };
  return [
    {
      title: 'First workout',
      cases: [{ ...base, key: 'first', caption: 'Never finished a workout', dates: [], finishedCount: 0, weekday: 1 }],
    },
    {
      title: 'At risk, target 3',
      cases: [
        {
          ...base,
          key: 'risk-two',
          caption: '2-week streak, 1 done, Saturday: two more by Sunday',
          dates: [...cal.hitWeeks(2, target), cal.day(0, 0)],
          weekday: 5,
        },
        {
          ...base,
          key: 'risk-today',
          caption: '1-week streak, 2 done, Sunday: one more today',
          dates: [...cal.hitWeeks(1, target), cal.day(0, 0), cal.day(0, 1)],
          weekday: 6,
        },
        {
          ...base,
          key: 'risk-tomorrow',
          caption: '3-week streak, 2 done, trained Saturday: one more tomorrow',
          dates: [...cal.hitWeeks(3, target), cal.day(0, 0), cal.day(0, 5)],
          weekday: 5,
        },
      ],
    },
    {
      title: 'Streak chip, target 3',
      cases: STREAK_CHIPS.map((n) => ({
        ...base,
        key: `streak-${n}`,
        caption: `${n}-week streak, this week hit`,
        dates: [...cal.hitWeeks(n - 1, target), ...cal.thisWeek(target)],
        weekday: target - 1,
        replay: true,
      })),
    },
    {
      // The medal takes the plates' slot; the line keeps its own row.
      title: 'Medal week slot',
      cases: [
        {
          ...base,
          key: 'medal-slot-plain',
          caption: '3-week streak, this week hit: plates, for height',
          dates: [...cal.hitWeeks(2, target), ...cal.thisWeek(target)],
          weekday: target - 1,
          replay: true,
        },
        {
          ...base,
          key: 'medal-slot-t2',
          caption: '2-week streak, target 2: a narrow slot',
          target: 2,
          dates: [...cal.hitWeeks(1, 2), ...cal.thisWeek(2)],
          weekday: 1,
          replay: true,
        },
        {
          ...base,
          key: 'medal-slot-over',
          caption: '4-week streak, target 5, 7 done: a full slot',
          target: 5,
          dates: [...cal.hitWeeks(3, 5), ...cal.thisWeek(7)],
          weekday: 6,
          replay: true,
        },
        {
          ...base,
          key: 'medal-slot-156',
          caption: '156-week streak: the 104 art, three digits',
          dates: [...cal.hitWeeks(155, target), ...cal.thisWeek(target)],
          weekday: target - 1,
          replay: true,
        },
      ],
    },
    {
      title: 'Rest week and reset, target 3',
      cases: [
        {
          ...base,
          key: 'rest-banked',
          caption: '4 weeks hit, rest week banked, 1 done',
          dates: [...cal.hitWeeks(4, target), cal.day(0, 0)],
          weekday: 1,
        },
        {
          ...base,
          key: 'rest-used',
          caption: '4 weeks hit, last week missed on the banked rest week, 0 done',
          dates: cal.hitWeeks(4, target, 2),
          weekday: 0,
        },
        {
          ...base,
          key: 'reset',
          caption: '3 weeks hit, last week missed, 0 done',
          dates: cal.hitWeeks(3, target, 2),
          weekday: 0,
        },
      ],
    },
  ];
}

function build(c: Case, cal: ReturnType<typeof calendar>): Built {
  // Noon, clear of any midnight edge.
  const today = cal.at(0, c.weekday);
  today.setHours(12);
  const state = weekCardState({ dates: c.dates, target: c.target, finishedCount: c.finishedCount, today });
  // Never shown this week, so the reset line always gets its turn.
  const line = weekCardLine(state, { resetShownFor: null }, today);
  return { ...c, state, line, today };
}

export default function WeekCardGallery() {
  const app = useTheme();
  const [scheme, setScheme] = useState<ColorScheme>(app.scheme);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeOverride scheme={scheme}>
      <Gallery scheme={scheme} setScheme={setScheme} />
    </ThemeOverride>
  );
}

function Gallery({ scheme, setScheme }: { scheme: ColorScheme; setScheme: (s: ColorScheme) => void }) {
  const { colors: c } = useTheme();
  const { width } = useWindowDimensions();
  const [offset, setOffset] = useState(0);
  const cards = useRef(new Map<string, WeekCardHandle>());
  const share = useRef<StreakShareHandle>(null);
  // Inside a 1pt edge, whose corner follows the card's 48 of 1080.
  const shareSize = width - spacing.screen * 2 - 2;

  const monday = useMemo(() => {
    const d = mondayOf(new Date());
    d.setDate(d.getDate() + offset * 7);
    return d;
  }, [offset]);
  const index = weekIndex(isoFromLocalDate(monday));

  const sections = useMemo(() => {
    const cal = calendar(monday);
    return [
      ...TARGETS.map((t) => ({ title: `Target ${t}`, cases: countCases(t, cal) })),
      ...extraCases(cal),
    ].map((s) => ({ title: s.title, cards: s.cases.map((k) => build(k, cal)) }));
  }, [monday]);

  const weekLabel = monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} {...scrollInsetProps}>
        <View style={styles.controls}>
          <View style={styles.row}>
            <Chip label="Light" selected={scheme === 'light'} onPress={() => setScheme('light')} c={c} />
            <Chip label="Dark" selected={scheme === 'dark'} onPress={() => setScheme('dark')} c={c} />
          </View>
          <View style={styles.row}>
            <Stepper label="−" onPress={() => setOffset((o) => o - 1)} />
            <View style={styles.weekLabel}>
              <Text style={[type.button, { color: c.text }]}>Week of {weekLabel}</Text>
              <Text style={[type.meta, styles.tabular, { color: c.text3 }]}>
                {offset === 0 ? 'This week' : `${offset > 0 ? '+' : ''}${offset} weeks`}. Pools of 3 on line{' '}
                {(index % 3) + 1}, pools of 7 on line {(index % 7) + 1}.
              </Text>
            </View>
            <Stepper label="+" onPress={() => setOffset((o) => o + 1)} />
          </View>
        </View>

        {sections.map((s) => (
          <Section key={s.title} title={s.title} c={c}>
            {s.cards.map((b) => (
              <View key={b.key} style={styles.case}>
                <Text style={[type.meta, { color: c.text2 }]}>
                  {b.caption} <Text style={{ color: c.text3 }}>({b.state.phase})</Text>
                </Text>
                <WeekCardView
                  ref={(h) => {
                    if (h) cards.current.set(b.key, h);
                    else cards.current.delete(b.key);
                  }}
                  state={b.state}
                  line={b.line}
                  dates={b.dates}
                  today={b.today}
                  onPress={() => {}}
                  onShareStreak={() => {
                    const real = streakShare(b.dates, b.target, b.today);
                    if (real) share.current?.present(real);
                  }}
                />
                {b.replay ? (
                  <Pressable
                    onPress={() => cards.current.get(b.key)?.play()}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.replay, { borderColor: c.border }, pressed && styles.pressed]}>
                    <Text style={[type.button, { color: c.accentText }]}>Replay celebration</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Section>
        ))}

        <Section title="Summary, target 3" c={c}>
          {SUMMARY_CASES.map((k) => (
            <SummaryCase key={k.key} monday={monday} streak={k.streak} light={'light' in k} caption={k.caption} />
          ))}
        </Section>

        <Section title="Medals" c={c}>
          {(['earned', 'locked'] as const).map((variant) => (
            <View key={variant} style={styles.case}>
              <Text style={[type.meta, { color: c.text2 }]}>{variant === 'earned' ? 'Earned' : 'Locked'}</Text>
              {MEDAL_SIZES.map((size) => (
                <View key={size} style={styles.medals}>
                  {RUNGS.map((r) => (
                    <Medal key={r} weeks={r} size={size} variant={variant} />
                  ))}
                </View>
              ))}
            </View>
          ))}
          <View style={styles.case}>
            <Text style={[type.meta, { color: c.text2 }]}>Share card variant, on plate blue</Text>
            <View style={[styles.medals, styles.onBlue]}>
              {RUNGS.map((r) => (
                <Medal key={r} weeks={r} size={72} variant="share" />
              ))}
            </View>
          </View>
        </Section>

        <Section title="Streak share card" c={c}>
          {SHARE_CARDS.map((n) => (
            <View key={n} style={styles.case}>
              <Text style={[type.meta, { color: c.text2 }]}>{n}-week streak</Text>
              <Pressable
                onPress={() => share.current?.present(fakeShare(n))}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${n}-week streak card`}
                style={({ pressed }) => [
                  styles.shareCard,
                  { borderColor: c.border, borderRadius: (shareSize * 48) / CARD_SIZE + 1 },
                  pressed && styles.pressed,
                ]}>
                <StreakCard share={fakeShare(n)} size={shareSize} />
              </Pressable>
            </View>
          ))}
        </Section>
      </ScrollView>
      <StreakShareSheet ref={share} />
    </View>
  );
}

const SUMMARY_CASES = [
  { key: 'sum-2', streak: 2, caption: 'Workout that earns the 2-week medal' },
  { key: 'sum-26', streak: 26, caption: 'Workout that earns the 26-week medal' },
  { key: 'sum-156', streak: 156, caption: 'Workout that earns the 156-week medal (104 art)' },
  { key: 'sum-plain', streak: 3, caption: 'Normal workout: hits the week, 3 is not a rung' },
  {
    key: 'sum-2-light',
    streak: 2,
    light: true,
    caption: 'Earns the 2-week medal under the lightest object: no comparison card, as on main',
  },
];

/** 12,450 lbs, so the volume comparison card shows, as it would on the summary. */
const FAKE_VOLUME_LB = 12450;
const FAKE_COMPARISON = pickVolumeComparison(FAKE_VOLUME_LB);

/**
 * Made-up workout cards for the summary cases, with the comparison picked
 * from the real table (its first line, so it holds still between renders).
 */
const FAKE_CARD: CardData = {
  username: 'alan',
  name: 'Full Body A',
  dateLabel: 'Wednesday, September 30',
  duration: '52 min',
  volume: `${FAKE_VOLUME_LB.toLocaleString()} lbs`,
  sets: 15,
  exercises: [
    { name: 'Barbell Squat', sets: 5 },
    { name: 'Barbell Bench Press', sets: 5 },
    { name: 'Barbell Row', sets: 5 },
  ],
  comparison: FAKE_COMPARISON
    ? { slug: FAKE_COMPARISON.slug, ...comparisonParts(FAKE_COMPARISON.lines[0]) }
    : null,
};

/**
 * One summary: `streak - 1` hit weeks behind this one, then this week hit
 * on Wednesday by the workout summarized. The medal comes from workoutMedal
 * over those dates, as on the real summary.
 */
function SummaryCase({
  monday,
  streak,
  light = false,
  caption,
}: {
  monday: Date;
  streak: number;
  /** Volume under the lightest object, so no comparison card. */
  light?: boolean;
  caption: string;
}) {
  const { colors: c } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const { pages, medal, share } = useMemo(() => {
    const cal = calendar(monday);
    const dates = [...cal.hitWeeks(streak - 1, 3), ...cal.thisWeek(3)];
    const workoutDate = cal.day(0, 2);
    const weeks = workoutMedal(dates, 3, workoutDate);
    const real = weeks != null ? streakShare(dates, 3, cal.at(0, 2)) : null;
    return {
      pages: summaryPages({ comparison: !light && FAKE_CARD.comparison != null, medal: weeks != null }),
      medal: weeks,
      share: real && weeks != null ? { ...real, weeks } : null,
    };
  }, [monday, streak, light]);
  return (
    <View style={styles.case}>
      <Text style={[type.meta, { color: c.text2 }]}>
        {caption} <Text style={{ color: c.text3 }}>({pages.length} cards)</Text>
      </Text>
      {/* The carousel pages at the window width; pull it out to the screen edges. */}
      <View style={styles.bleed}>
        <SummaryCarousel
          pages={pages}
          data={light ? { ...FAKE_CARD, volume: '40 lbs', comparison: null } : FAKE_CARD}
          medalShare={share}
          width={width}
          cardWidth={width - spacing.screen * 2}
          page={page}
          onPage={setPage}
        />
      </View>
      {medal != null ? <MedalEarnedLine weeks={medal} /> : null}
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Next week' : 'Previous week'}
      style={({ pressed }) => [styles.stepper, { borderColor: c.border }, pressed && styles.pressed]}>
      <Text style={[type.button, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl },
  controls: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekLabel: { flex: 1, alignItems: 'center', gap: 2 },
  tabular: { ...tabular, textAlign: 'center' },
  case: { gap: spacing.sm },
  bleed: { marginHorizontal: -spacing.screen },
  medals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  onBlue: { backgroundColor: palettes.light.accent, borderRadius: radius.card, padding: spacing.card },
  stepper: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: radius.bar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replay: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // A 1pt edge so the card shows against the page in both modes.
  shareCard: { alignSelf: 'center', borderWidth: 1, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
});
