/**
 * Onboarding's "Import your workouts" link (docs/import-prompts-spec.md).
 * The link finishes onboarding the way Skip does, and `complete()` unmounts
 * the flow before `/import` is reachable (the route sits behind the
 * onboarded guard), so the flow cannot open it itself. It sets this flag
 * instead, and Home opens `/import` on its first mount after, once.
 *
 * In memory only: a relaunch never opens the import on its own.
 */
let pending = false;

/** Called by onboarding just before it finishes. */
export function requestImportOnHome(): void {
  pending = true;
}

/** True once per request, for Home's mount. */
export function takeImportOnHome(): boolean {
  const was = pending;
  pending = false;
  return was;
}
