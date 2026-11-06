import { APP_STORAGE_PREFIX } from "./account-deletion";
import { byVariationOrder, routineProgram } from "./templates";

/**
 * The setup checklist on Home: five first-week tasks, each worked out from
 * data the app already has, except the invite and the hide, which are
 * timestamps on `user_profiles`.
 *
 * Every user has all five, so the header's "N of M" never changes its M.
 * A guest's first task is the account: "Create a free account", since a
 * guest can finish one workout and needs an account to start the next
 * (start-gate.ts). From the first finished workout it is promoted, with
 * its own button, until the account is linked. A signed-in account has it
 * done, as "Save your workouts".
 */

export type SetupTaskKey = "save" | "log" | "profile" | "routine" | "invite";

export type SetupTask = {
  key: SetupTaskKey;
  title: string;
  subtitle: string;
  done: boolean;
  /**
   * The save task for a guest who has finished a workout: tinted, with its
   * own button, because those workouts now exist on one phone only.
   */
  promoted: boolean;
};

export type SetupInput = {
  /** From the session, not the database. */
  isAnonymous: boolean;
  finishedCount: number;
  /** The user's own templates. */
  mineCount: number;
  sex: string | null;
  /** YYYY-MM-DD. */
  birthday: string | null;
  bodyweight: number | null;
  invitedFriendAt: string | null;
  /** Counts only while the invite is the only task left; see setupCardMode. */
  setupHiddenAt: string | null;
};

export type SetupState = {
  /**
   * All five, in a fixed order, so a finished task keeps its place and the
   * total never changes. "Do your first workout" is always there, even
   * beside Home's Next up card, and starts the same routine day that card
   * does.
   */
  tasks: SetupTask[];
  doneCount: number;
  /** Always 5. */
  total: number;
  allDone: boolean;
  /**
   * "Invite a friend" is the only task not done. The one state in which the
   * card offers Hide, and the only one a hide applies to.
   */
  canHide: boolean;
};

/** The account ask's title for a guest: the checklist task, before and after the first workout, and Home's row. */
export const CREATE_ACCOUNT_TITLE = "Create a free account";

/** Under it once the guest has a finished workout: the checklist's promoted row and Home's row. */
export const NEXT_WORKOUT_LINE = "Needed to log your next workout";

/** Whether a guest has anything to save yet. Home's save row and task both wait for it. */
export function shouldOfferSave(input: { isAnonymous: boolean; finishedCount: number }): boolean {
  return input.isAnonymous && input.finishedCount >= 1;
}

export function setupTasks(input: SetupInput): SetupState {
  const promoteSave = shouldOfferSave(input);
  const save: SetupTask = promoteSave
    ? {
        key: "save",
        title: CREATE_ACCOUNT_TITLE,
        subtitle: NEXT_WORKOUT_LINE,
        done: false,
        promoted: true,
      }
    : input.isAnonymous
      ? {
          key: "save",
          title: CREATE_ACCOUNT_TITLE,
          subtitle: "Keep training after your first workout",
          done: false,
          promoted: false,
        }
      : {
          key: "save",
          title: "Save your workouts",
          subtitle: "Add Apple or Google so they're on your next phone",
          done: true,
          promoted: false,
        };
  const task = (t: Omit<SetupTask, "promoted">): SetupTask => ({ ...t, promoted: false });
  const tasks: SetupTask[] = [
    save,
    task({
      key: "log",
      title: "Do your first workout",
      subtitle: input.mineCount >= 1 ? "Start the next day of your routine" : "Pick a routine to start with",
      done: input.finishedCount >= 1,
    }),
    task({
      key: "profile",
      title: "Complete your profile",
      subtitle: "Add a few details about yourself",
      done: input.sex != null && input.birthday != null && input.bodyweight != null,
    }),
    task({
      key: "routine",
      title: "Save a routine",
      subtitle: "Tap Use on any starter routine",
      done: input.mineCount >= 1,
    }),
    task({
      key: "invite",
      title: "Invite a friend",
      subtitle: "Lifting is easier with company",
      done: input.invitedFriendAt != null,
    }),
  ];
  const doneCount = tasks.filter((t) => t.done).length;
  const undone = tasks.filter((t) => !t.done);
  return {
    tasks,
    doneCount,
    total: tasks.length,
    allDone: undone.length === 0,
    canHide: undone.length === 1 && undone[0].key === "invite",
  };
}

/** Device storage key: this user has seen the finished checklist. Under the app prefix, so account deletion clears it. */
export function setupCompletedSeenKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}setup-completed-seen:${userId}`;
}

/** How Home shows the checklist: not at all, with its tasks, or finished ("All done"). */
export type SetupCardMode = "hidden" | "open" | "done";

/**
 * The checklist stays on Home until every task is done, then stays,
 * finished, for the rest of the app session in which its last task
 * ticked, and is gone from the next launch.
 *
 * - Only the invite left and the user hid the card: hidden. A hide counts
 *   in that state only, so if another task unticks later (the last
 *   routine removed) the card comes back.
 * - Any other task not done: open, even after a finish was seen.
 * - All done after a hide: hidden.
 * - All done and already shown finished this session: done.
 * - All done and never seen finished on this phone: done, and the caller
 *   records it as seen, so the next launch hides it.
 * - All done and seen on an earlier launch: hidden. While that is still
 *   being read (undefined), hidden too, so the card cannot flash.
 */
export function setupCardMode(
  setup: SetupState,
  input: { setupHiddenAt: string | null; completionSeen: boolean | undefined; doneShownThisSession: boolean },
): SetupCardMode {
  const hidden = input.setupHiddenAt != null;
  if (!setup.allDone) return hidden && setup.canHide ? "hidden" : "open";
  if (hidden) return "hidden";
  if (input.doneShownThisSession || input.completionSeen === false) return "done";
  return "hidden";
}

/**
 * The routine day "Do your first workout" starts. Groups and their days
 * arrive in Home's order. Null when there are no routines.
 *
 * - Nothing done yet: the first day of the first routine.
 * - Last done in a multi-day routine: the day after the last one done in
 *   that routine, wrapping to the first.
 * - Last done in a routine of one (a routine built by hand or saved from a
 *   workout): the least recently done routine of one. A routine of one
 *   never done comes first, in list order; otherwise the one whose last
 *   finish is oldest. Five standalone routines done one a day then rotate
 *   like a week, and a skipped day is offered next.
 */
export function nextRoutineDay<T extends { lastDone: string | null; lastDoneAt?: string | null }>(
  groups: { templates: T[] }[],
): T | null {
  // The finish time when there is one, so two days done on the same date
  // still have an order; the date alone otherwise.
  const doneAt = (t: T) => t.lastDoneAt ?? t.lastDone;
  let latest: { group: number; day: number; at: string } | null = null;
  groups.forEach((g, group) =>
    g.templates.forEach((t, day) => {
      const at = doneAt(t);
      if (at && (!latest || at > latest.at)) latest = { group, day, at };
    }),
  );
  if (!latest) return groups.find((g) => g.templates.length > 0)?.templates[0] ?? null;
  const { group, day } = latest as { group: number; day: number };
  const days = groups[group].templates;
  if (days.length > 1) return days[(day + 1) % days.length];

  const singles = groups.filter((g) => g.templates.length === 1).map((g) => g.templates[0]);
  const neverDone = singles.find((t) => !doneAt(t));
  if (neverDone) return neverDone;
  let stalest = singles[0];
  for (const t of singles) {
    if ((doneAt(t) as string) < (doneAt(stalest) as string)) stalest = t;
  }
  return stalest;
}

/** Routine id to the ISO time of its Skip on Home's card. Kept on the phone. */
export type UpNextSkips = Record<string, string>;

/** Device storage key for the skips. Under the app prefix, so account deletion clears it. */
export function upNextSkipKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}upnext-skip:${userId}`;
}

/** The stored skips. Anything unreadable counts as none: a skip is only a preference. */
export function parseUpNextSkips(raw: string | null): UpNextSkips {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return {};
  }
}

type SkippableDay = { id: string; lastDone: string | null; lastDoneAt?: string | null };

function timeOf(at: string | null | undefined): number {
  return at ? Date.parse(at) : -Infinity;
}

function finishTime(t: SkippableDay): number {
  return timeOf(t.lastDoneAt ?? t.lastDone);
}

/** The day ranked at its skip, unless a later finish has replaced the skip. */
function withStandingSkip<T extends SkippableDay>(t: T, skips: UpNextSkips): T {
  return timeOf(skips[t.id]) > finishTime(t) ? { ...t, lastDoneAt: skips[t.id] } : t;
}

/** Whether a day has been skipped since the last finish of any day. */
function skippedSinceLastFinish(days: SkippableDay[], skips: UpNextSkips): (t: SkippableDay) => boolean {
  const lastFinish = Math.max(-Infinity, ...days.map(finishTime));
  return (t) => timeOf(skips[t.id]) > lastFinish;
}

/**
 * The routine day Home's Next up offers: `nextRoutineDay`, with each skip
 * ranked as if the day was done at that moment. Ranking only: "last done"
 * labels still read the real finish.
 *
 * - A finish later than the skip replaces it.
 * - `nextRoutineDay` stays in the routine done last, so skips alone would
 *   go round that routine for ever. When it comes back to a day skipped
 *   since the last finish, the offer moves to a day not skipped yet, in
 *   any routine, and once every day has been skipped, to the day skipped
 *   longest ago. So skipping in turn reaches every day.
 */
export function upNextDay<T extends SkippableDay>(groups: { templates: T[] }[], skips: UpNextSkips): T | null {
  const days = groups.flatMap((g) => g.templates);
  const skippedSinceFinish = skippedSinceLastFinish(days, skips);

  const ranked = groups.map((g) => ({ templates: g.templates.map((t) => withStandingSkip(t, skips)) }));
  const original = (t: T | null) => days.find((d) => d.id === t?.id) ?? null;

  const next = nextRoutineDay(ranked);
  if (!next || !skippedSinceFinish(next)) return original(next);
  const notSkipped = ranked.map((g) => ({ templates: g.templates.filter((t) => !skippedSinceFinish(t)) }));
  const moved = nextRoutineDay(notSkipped.filter((g) => g.templates.length > 0));
  if (moved) return original(moved);
  return days.reduce((oldest, t) => (timeOf(skips[t.id]) < timeOf(skips[oldest.id]) ? t : oldest));
}

/**
 * Saved days as Home groups them: every day of a routine together, in
 * training order (`byVariationOrder`), routines in the order they arrive,
 * and a day of its own as a routine of one.
 */
export function groupByRoutine<T extends { id: string; name: string; position?: number | null; program?: string | null }>(
  days: T[],
): { key: string; program: string | null; templates: T[] }[] {
  const groups: { key: string; program: string | null; templates: T[] }[] = [];
  const byProgram = new Map<string, { key: string; program: string | null; templates: T[] }>();
  for (const t of days) {
    // A day saved before copies carried `program` still joins its routine
    // through its name ("Bro Split · Shoulders & Traps").
    const program = routineProgram(t);
    if (!program) {
      groups.push({ key: t.id, program: null, templates: [t] });
      continue;
    }
    let g = byProgram.get(program);
    if (!g) {
      g = { key: `program:${program}`, program, templates: [] };
      byProgram.set(program, g);
      groups.push(g);
    }
    g.templates.push(t);
  }
  for (const g of groups) {
    if (g.program) g.templates.sort(byVariationOrder);
  }
  return groups;
}

/**
 * Every saved day for the Workout tab, stalest first: the first is the Up
 * next hero, the rest are the rows under it. Flat, whatever routine a day
 * belongs to (docs/workout-tab-spec.md, Sort order).
 *
 * - The key is the finish time when there is one, the date otherwise.
 * - A day never done is older than any day done.
 * - Ties, such as every day of a routine just copied, keep a routine's
 *   days together: routines in the order they arrive (a day of its own is
 *   a routine of one), then training order within a routine
 *   (`byVariationOrder`: position, then name).
 *
 * - A skip ranks the day as done at that moment, as on Home (`upNextDay`).
 * - While a skip is newer than every finish, the first day is `upNextDay`'s
 *   pick, so Home and this tab offer the same day after a Skip.
 *
 * With no skip that recent, Home's Next up is `nextRoutineDay`, which stays
 * inside the routine done last, and this order does not, so the two can
 * differ, by design (docs/workout-tab-spec.md).
 */
export function routinesByStaleness<
  T extends {
    id: string;
    lastDone: string | null;
    lastDoneAt?: string | null;
    position?: number | null;
    name: string;
    program?: string | null;
  },
>(days: T[], skips: UpNextSkips = {}): T[] {
  const doneAt = (t: T) => {
    const ranked = withStandingSkip(t, skips);
    return ranked.lastDoneAt ?? ranked.lastDone ?? null;
  };
  // Each routine's place in the input, by its first day there.
  const routineOrder = new Map<string, number>();
  const routineOf = (t: T) => {
    const program = routineProgram(t);
    return program ? `program:${program}` : `day:${t.id}`;
  };
  for (const t of days) {
    const key = routineOf(t);
    if (!routineOrder.has(key)) routineOrder.set(key, routineOrder.size);
  }
  const sorted = [...days].sort((a, b) => {
    const da = doneAt(a);
    const db = doneAt(b);
    if (da !== db) {
      if (da == null) return -1;
      if (db == null) return 1;
      return da < db ? -1 : 1;
    }
    return routineOrder.get(routineOf(a))! - routineOrder.get(routineOf(b))! || byVariationOrder(a, b);
  });
  if (!days.some(skippedSinceLastFinish(days, skips))) return sorted;
  const first = upNextDay(groupByRoutine(days), skips);
  return first ? [first, ...sorted.filter((t) => t !== first)] : sorted;
}
