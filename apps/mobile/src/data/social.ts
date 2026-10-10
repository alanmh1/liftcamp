import type {
  FeedCursor,
  FeedItem,
  FollowRow,
  FollowStatus,
  InvitePreview,
  KudosInboxRow,
  KudosState,
} from '@liftcamp/shared';

import type { ExerciseInfo } from '@/data/workouts';

import { supabase } from '../../lib/supabase';

/**
 * Calls for follows, invites and blocks (docs/social-spec.md). Every one is
 * a SECURITY DEFINER function in supabase/migrations/20261004120000_social_schema.sql;
 * no table is read or written directly. Screens never import `supabase`.
 *
 * Online only. Nothing here goes through the write queue: a follow needs
 * the other person's answer, so there is nothing useful to do offline.
 * Never throws: every call answers a SocialResult, so a read at launch or
 * on Home focus cannot leave an unhandled rejection.
 *
 * A refusal comes back as the server's own message ("Use their invite link
 * to follow them."), which is written to be shown as it is. A request that
 * never reached the server gets a generic line.
 */

export type SocialResult<T> = { ok: true; data: T } | { ok: false; message: string };

const OFFLINE = 'Could not reach LiftCamp. Check your connection and try again.';

async function call<T>(run: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<SocialResult<T>> {
  try {
    const { data, error } = await run();
    if (error) {
      // Raised by the functions with a sentence for the user. Anything
      // else (a network or gateway failure) gets the generic line.
      const known = error.code === '42501' || error.code === 'P0002' || error.code === '22023';
      return { ok: false, message: known && error.message ? error.message : OFFLINE };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

/** Social on for the caller, asked now rather than from the launch latch. */
export function socialAccessNow(): Promise<SocialResult<boolean>> {
  return call(() => supabase.rpc('social_access'));
}

/** The caller's invite code, made on first use. */
export function myInviteCode(): Promise<SocialResult<string>> {
  return call(() => supabase.rpc('my_invite_code'));
}

/** A new code; the old link stops working. */
export function regenerateInviteCode(): Promise<SocialResult<string>> {
  return call(() => supabase.rpc('regenerate_invite_code'));
}

/** The inviter behind a code, or no row when the code does not work for the caller. */
export function invitePreview(code: string): Promise<SocialResult<InvitePreview[]>> {
  return call(() => supabase.rpc('invite_preview', { p_code: code }));
}

/**
 * From an invite: 'follow' asks to follow the inviter, 'let_follow' offers
 * to let them follow the caller. Answers the row's status; 'accepted' when
 * it met a request the inviter had already sent.
 */
export function requestFollow(code: string, direction: 'follow' | 'let_follow'): Promise<SocialResult<FollowStatus>> {
  return call(() => supabase.rpc('request_follow', { p_code: code, p_direction: direction }));
}

/** Follow back: only toward someone already connected by a follow row. */
export function requestFollowUser(userId: string): Promise<SocialResult<FollowStatus>> {
  return call(() => supabase.rpc('request_follow_user', { p_user: userId }));
}

/** Approve or decline a request waiting on the caller. Decline is silent. */
export function respondFollow(row: Pick<FollowRow, 'follower_id' | 'followee_id'>, accept: boolean): Promise<SocialResult<FollowStatus>> {
  return call(() =>
    supabase.rpc('respond_follow', { p_follower: row.follower_id, p_followee: row.followee_id, p_accept: accept }),
  );
}

/** Withdraw a request, unfollow, or remove a follower. Silent either way. */
export function endFollow(row: Pick<FollowRow, 'follower_id' | 'followee_id'>): Promise<SocialResult<null>> {
  return call(() => supabase.rpc('end_follow', { p_follower: row.follower_id, p_followee: row.followee_id }));
}

/** Every follow row the caller is in, with the other person's username. */
export function listFollows(): Promise<SocialResult<FollowRow[]>> {
  return call(() => supabase.rpc('list_follows'));
}

/** Removes follows both ways and stops new requests between the two. */
export function blockUser(userId: string): Promise<SocialResult<null>> {
  return call(() => supabase.rpc('block_user', { p_user: userId }));
}

export function unblockUser(userId: string): Promise<SocialResult<null>> {
  return call(() => supabase.rpc('unblock_user', { p_user: userId }));
}

export type BlockedUser = { user_id: string; username: string | null; created_at: string };

export function listBlocks(): Promise<SocialResult<BlockedUser[]>> {
  return call(() => supabase.rpc('list_blocks'));
}

// ---------------------------------------------------------------------------
// Feed, people and kudos (social-feed)
// ---------------------------------------------------------------------------

/**
 * Finished workouts newest first: the following feed (last 14 days) with no
 * `user`, or one person's workouts, any age, with `user`. Pages on the last
 * item's finished_at and id.
 */
export async function socialFeed(opts: {
  cursor: FeedCursor | null;
  limit: number;
  user?: string;
}): Promise<SocialResult<FeedItem[]>> {
  const result = await call<FeedItem[] | null>(() =>
    supabase.rpc('social_feed', {
      p_before: opts.cursor?.before,
      p_before_id: opts.cursor?.beforeId,
      p_limit: opts.limit,
      p_user: opts.user,
    }),
  );
  if (!result.ok) return result;
  // The cards draw from these fields; a row without them never reaches one.
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .filter((r) => r && typeof r.workout_id === 'string' && typeof r.user_id === 'string')
      .map((r) => ({
        ...r,
        exercises: Array.isArray(r.exercises) ? r.exercises : [],
        volume: r.volume == null ? null : Number(r.volume),
        kudos_count: Number(r.kudos_count) || 0,
        kudos_given: r.kudos_given === true,
        completed_sets: Number(r.completed_sets) || 0,
      })),
  };
}

export type FriendWorkoutSet = {
  id: string;
  position: number;
  weight: string | null;
  weight_value: number | null;
  weight_unit: string;
  reps: number | null;
  completed: boolean;
  /** 'warmup' for a warm-up row (docs/pro-warmup-social-counts.sql), badged W. */
  set_type?: string | null;
};

export type FriendWorkoutExercise = {
  id: string;
  position: number;
  /** Null when the owner's phone did not know. */
  pr: boolean | null;
  exercise: ExerciseInfo;
  sets: FriendWorkoutSet[];
};

/** social_workout(): another person's finished workout, or null when the caller cannot see it. */
export type FriendWorkout = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  note: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string;
  volume: number | null;
  volume_unit: string | null;
  pr_count: number | null;
  completed_sets: number;
  kudos_count: number;
  kudos_given: boolean;
  exercises: FriendWorkoutExercise[];
};

export async function socialWorkout(workoutId: string): Promise<SocialResult<FriendWorkout | null>> {
  const result = await call<FriendWorkout | null>(() => supabase.rpc('social_workout', { p_workout: workoutId }));
  if (!result.ok || !result.data || typeof result.data !== 'object') return result.ok ? { ok: true, data: null } : result;
  const w = result.data;
  return {
    ok: true,
    data: {
      ...w,
      exercises: (Array.isArray(w.exercises) ? w.exercises : []).map((we) => ({
        ...we,
        sets: Array.isArray(we.sets) ? we.sets : [],
      })),
      volume: w.volume == null ? null : Number(w.volume),
      kudos_count: Number(w.kudos_count) || 0,
      kudos_given: w.kudos_given === true,
      completed_sets: Number(w.completed_sets) || 0,
    },
  };
}

/** social_profile(): one row while the two are connected by a follow either way, none otherwise. */
export type SocialProfile = {
  user_id: string;
  username: string | null;
  i_follow: FollowStatus | null;
  follows_me: FollowStatus | null;
  /** An accepted follow from me with no block: their workouts are visible. */
  can_view: boolean;
};

export function socialProfile(userId: string): Promise<SocialResult<SocialProfile[]>> {
  return call(() => supabase.rpc('social_profile', { p_user: userId }));
}

/** social_streak(): their weekly target and finished workout dates. No row when not visible. */
export type SocialStreak = { weekly_target: number; dates: string[] };

export function socialStreak(userId: string): Promise<SocialResult<SocialStreak[]>> {
  return call(() => supabase.rpc('social_streak', { p_user: userId }));
}

/** Gives kudos, or takes it back when given. Answers the state after. */
export async function toggleKudosOn(workoutId: string): Promise<SocialResult<KudosState>> {
  const result = await call<{ given: boolean; kudos_count: number }[]>(() =>
    supabase.rpc('toggle_kudos', { p_workout: workoutId }),
  );
  if (!result.ok) return result;
  const row = result.data?.[0];
  return row ? { ok: true, data: { given: row.given, count: row.kudos_count } } : { ok: false, message: OFFLINE };
}

export type KudosGiver = { user_id: string; username: string | null; created_at: string };

/** Who gave kudos on one of the caller's own workouts, newest first. */
export function workoutKudos(workoutId: string): Promise<SocialResult<KudosGiver[]>> {
  return call(() => supabase.rpc('workout_kudos', { p_workout: workoutId }));
}

/** Kudos others gave on the caller's workouts in the last 30 days, for the inbox. */
export function kudosInbox(): Promise<SocialResult<KudosInboxRow[]>> {
  return call(() => supabase.rpc('social_kudos_inbox', {}));
}
