import type { FollowRow, FollowStatus, InvitePreview } from '@liftcamp/shared';

import { supabase } from '../../lib/supabase';

/**
 * Calls for follows, invites and blocks (docs/social-spec.md). Every one is
 * a SECURITY DEFINER function in supabase/migrations/20261004120000_social_schema.sql;
 * no table is read or written directly. Screens never import `supabase`.
 *
 * Online only. Nothing here goes through the write queue: a follow needs
 * the other person's answer, so there is nothing useful to do offline.
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
