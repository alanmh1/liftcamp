import { supabase } from '../../lib/supabase';

/**
 * Development builds only: marks a new anonymous user as a developer's
 * with one `dev_user` row in app_events, so the activation funnel
 * (docs/funnel-query.sql) leaves it out. Called after every anonymous
 * sign-in a build makes: Continue as guest, a lost guest session replaced
 * at launch, and Start fresh as a new user.
 *
 * In a release build `__DEV__` is false at compile time and the body is
 * dead code, so nothing is ever written. Best effort, the same as the
 * other app_events reports: a failed insert only means one test user
 * stays in the funnel.
 */
export async function markDevUser(userId: string | undefined): Promise<void> {
  if (!__DEV__ || !userId) return;
  const { error } = await supabase.from('app_events').insert({ user_id: userId, name: 'dev_user' });
  if (error) console.warn(`[dev-user] not marked: ${error.message}`);
}
