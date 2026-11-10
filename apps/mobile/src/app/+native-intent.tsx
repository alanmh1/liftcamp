import { inviteCodeFromPath, isTikTokShareCallback } from '@liftcamp/shared';

import { savePendingInvite } from '@/lib/pending-invite';

/**
 * Every link the app is opened with passes through here first. An invite
 * (`liftcamp://invite/<code>`, the /i page's Open in LiftCamp button) is
 * saved on the phone rather than routed: the user may be mid-onboarding,
 * signed out or a guest, and the invite has to wait for an account
 * (lib/pending-invite.ts). PendingInviteHandler opens it from there.
 *
 * A cold start goes to the root, which lands wherever the app's state
 * says. A link into a running app navigates nowhere, so a workout on the
 * screen stays put; the handler opens the invite once the tabs are back
 * in front. Any other link routes as before (`liftcamp://workout/<id>`
 * from the Live Activity).
 *
 * TikTok's return from a share goes nowhere the same way: its SDK has the
 * link already (modules/share-targets), and it matches no route.
 */
export async function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isTikTokShareCallback(path)) return initial ? '/' : null;
  const code = inviteCodeFromPath(path);
  if (!code) return path;
  await savePendingInvite(code);
  return initial ? '/' : null;
}
