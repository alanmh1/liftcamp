import AsyncStorage from '@react-native-async-storage/async-storage';
import { signUpDueKey, signUpDueOnHome, startGate, type WeightUnit } from '@liftcamp/shared';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { useWeightUnit } from '@/components/unit-provider';
import * as home from '@/data/home';
import { networkFailedSince } from '@/lib/network';

/**
 * The guest limit: a guest can finish one workout, and starting another
 * needs an account (packages/shared start-gate.ts has the rules and tests).
 *
 * Every start goes through `guardStart`: Home's Next up, routine days,
 * Start new workout, Repeat and the checklist's first workout, the header
 * pill, Profile's first workout and History's Repeat. A start that would
 * open a workout already in progress is a resume and never comes here.
 *
 * Gated, the start is held and this sheet opens instead: the sign-in
 * screen in link mode with its own heading. A link that succeeds runs the
 * held start at once; "Not now" drops it. With no signal the start goes
 * ahead and a flag asks Home to show the sheet once the phone is online
 * and that workout is over (`offerIfDue`).
 */

type Go = () => Promise<void> | void;

type StartGateApi = {
  /** Runs `go` (a start and its navigation), or holds it behind the sheet. */
  guardStart: (go: Go) => Promise<void>;
  /** Home, after a load that reached the server: the sheet, if an offline second workout is over. */
  offerIfDue: (input: { finishedCount: number; inProgress: boolean }) => Promise<void>;
};

const Ctx = createContext<StartGateApi | null>(null);

export function useStartGate(): StartGateApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStartGate must be used inside <StartGateProvider>.');
  return v;
}

/** How long a start waits for the server's count before treating the phone as offline. */
const COUNT_WAIT_MS = 2500;

/**
 * The guest's finished workouts, the phone's unsynced finishes included,
 * and whether the server answered. The server's count doubles as the
 * signal check, capped at COUNT_WAIT_MS so nobody waits long in a gym
 * with no signal. Home's last load stands in for it offline.
 */
async function guestCount(userId: string, unit: WeightUnit) {
  const phone = await home.getLocalHomeState(userId, unit);
  const unsynced = phone.finished.length;
  const cached = home.peekHomeCache<{ finishedCount?: number }>(userId, unit)?.finishedCount;
  const started = Date.now();
  const server = await Promise.race([
    home.getFinishedWorkoutCount(userId).then((n) => (networkFailedSince(started) ? null : n)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), COUNT_WAIT_MS)),
  ]);
  if (server != null) {
    // The last load's count too, in case this read came back empty for a
    // reason other than signal.
    return { online: true, finishedCount: Math.max(server, cached ?? 0) + unsynced };
  }
  return {
    online: false,
    finishedCount: cached != null ? cached + unsynced : unsynced > 0 ? unsynced : null,
  };
}

export function StartGateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { unit } = useWeightUnit();
  const userId = session?.user.id;
  const anonymous = !!session?.user.is_anonymous;
  const [open, setOpen] = useState(false);
  const held = useRef<Go | null>(null);

  const guardStart = useCallback(
    async (go: Go) => {
      if (!userId || !anonymous) {
        await go();
        return;
      }
      const { online, finishedCount } = await guestCount(userId, unit);
      const decision = startGate({ isAnonymous: true, resuming: false, online, finishedCount });
      if (decision === 'sign-up') {
        held.current = go;
        setOpen(true);
        return;
      }
      if (decision === 'start-offline') {
        await AsyncStorage.setItem(signUpDueKey(userId), new Date().toISOString()).catch(() => {});
      }
      await go();
    },
    [userId, anonymous, unit],
  );

  const offerIfDue = useCallback(
    async ({ finishedCount, inProgress }: { finishedCount: number; inProgress: boolean }) => {
      if (!userId || !anonymous) return;
      const key = signUpDueKey(userId);
      const flagged = (await AsyncStorage.getItem(key).catch(() => null)) != null;
      if (!signUpDueOnHome({ flagged, isAnonymous: anonymous, online: true, inProgress, finishedCount })) return;
      await AsyncStorage.removeItem(key).catch(() => {});
      held.current = null;
      setOpen(true);
    },
    [userId, anonymous],
  );

  function close() {
    held.current = null;
    setOpen(false);
  }

  const api = useMemo(() => ({ guardStart, offerIfDue }), [guardStart, offerIfDue]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SignInScreen
          mode="link"
          title="Create a free account to keep going"
          lead="Your first workout is saved. Sign up to log your next one and keep your streak going."
          dismissLabel="Not now"
          onDismiss={close}
          onDone={(outcome) => {
            const go = held.current;
            close();
            if (outcome.ok && outcome.existingAccount) {
              // Signed into an account that already had this identity. The
              // held start was for the guest, so it is dropped; a tap now
              // starts as the signed-in account.
              Alert.alert(
                'Welcome back',
                "You're signed in to your existing account. Workouts from this guest session weren't added to it.",
              );
              return;
            }
            if (go) void go();
          }}
        />
      </Modal>
    </Ctx.Provider>
  );
}
