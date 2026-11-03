import { isDevBuild } from '@/lib/dev-build';
import { supabase } from '../../lib/supabase';

/**
 * Dev builds only (lib/dev-build: debug, or any Simulator or emulator
 * build): marks a new user as a developer's with one `dev_user` row in
 * app_events, so the funnel (docs/funnel-query.sql, dev_user_ids()) leaves
 * it out. Called only from lib/new-user, after every sign-in that created
 * an account.
 *
 * Best effort, the same as the other app_events reports: a failed insert
 * only means one test user stays in the funnel.
 */
export async function markDevUser(userId: string | undefined): Promise<void> {
  if (!isDevBuild() || !userId) return;
  const { error } = await supabase.from('app_events').insert({ user_id: userId, name: 'dev_user' });
  if (error) console.warn(`[dev-user] not marked: ${error.message}`);
}
