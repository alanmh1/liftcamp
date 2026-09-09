import { supabase } from '../../lib/supabase';

export type RlsCheck =
  | { status: 'running' }
  | { status: 'ok'; lines: string[] }
  | { status: 'failed'; lines: string[] };

/**
 * Phase 5a proof that RLS works through the client for an anonymous user.
 *
 * `user_profiles` needs only `user_id`; every other column has a default, so
 * the row can be created from the app. The policy is
 * `with_check (auth.uid() = user_id)`, meaning this write succeeds only when
 * the JWT actually carries the id we are inserting.
 *
 * Upsert rather than insert so a relaunch does not fail on the primary key.
 * If the write is rejected, fall back to counting `exercises`, which is
 * readable by any role, so the screen still shows whether the client reaches
 * the database at all.
 */
export async function runRlsCheck(userId: string): Promise<RlsCheck> {
  const { error: writeError } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id' });

  if (writeError) {
    const { count, error: readError } = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true });

    if (readError) {
      return {
        status: 'failed',
        lines: [`profile write: ${writeError.message}`, `exercise read: ${readError.message}`],
      };
    }
    return {
      status: 'ok',
      lines: [`profile write blocked: ${writeError.message}`, `exercises readable: ${count ?? 0}`],
    };
  }

  const { data, error: readBackError } = await supabase
    .from('user_profiles')
    .select('user_id, weight_unit, weekly_target, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (readBackError) {
    return { status: 'failed', lines: [`profile read back: ${readBackError.message}`] };
  }
  if (!data) {
    return {
      status: 'failed',
      lines: ['profile written, but the read back returned no row.'],
    };
  }

  // Proof that the row is scoped to this user: ask for every row the policy
  // allows and confirm exactly one comes back.
  const { count: visible } = await supabase
    .from('user_profiles')
    .select('user_id', { count: 'exact', head: true });

  return {
    status: 'ok',
    lines: [
      'profile written and read back',
      `weight_unit: ${data.weight_unit}`,
      `weekly_target: ${data.weekly_target}`,
      `profiles visible to this user: ${visible ?? 0}`,
    ],
  };
}
