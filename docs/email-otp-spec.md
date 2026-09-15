# LiftCamp mobile: email sign-in with a one-time code

## Why this exists

Real users signed up by email on web and cannot reach their accounts on the mobile app. Apple and Google sign-in work; email does not. This closes that gap.

A 6-digit code rather than a magic link. A link depends on the email opening on the same device the app is on and on the link surviving scanner prefetch, which is a problem this project has already hit with unsubscribe URLs. A code has neither dependency.

## Branch and workflow

TERMINAL. Branch `email-otp` off `workout-detail`. Commit and push. Do not merge.

Database rule: read-only queries only. No INSERT, UPDATE, DELETE, ALTER, CREATE. No schema change. If you conclude one is needed, stop and report.

JS-only. No new native modules, no new npm dependencies. `app.json` already declares `"scheme": "liftcamp"` and Supabase already allows `liftcamp://auth/callback`. Neither is used by this flow, and neither should be removed.

Report before building on the REPORT FIRST item. Everything else, build it.

## Prerequisites, already handled outside this repo

Do not attempt these and do not treat them as blockers. Alan has done or will do them in the Supabase dashboard:

- Custom SMTP through Resend is live, sending as LiftCamp at liftcamp.app. Verified working 15 Sep 2026.
- Auth email templates get `{{ .Token }}` added so the code appears in the message body.

If a code never arrives during testing, that is a dashboard problem, not a code problem. Report it rather than working around it.

## Files to read first

- `apps/mobile/src/lib/native-sign-in.ts`, all of it, especially `completeWithIdToken` and the `SignInOutcome` type
- `apps/mobile/src/components/sign-in-screen.tsx`
- `apps/mobile/src/app/link-account.tsx`
- `apps/mobile/src/app/sign-in.tsx`
- `apps/mobile/src/components/auth-provider.tsx`
- `apps/mobile/src/theme/tokens.ts`

## The two modes, and why they use different Supabase calls

`SignInScreen` already has `signIn` and `link` modes, and `native-sign-in.ts` routes them to `signInWithIdToken` and `linkIdentity`. Email does not use either API, so this is not a matter of passing a third provider string.

**signIn mode.** `supabase.auth.signInWithOtp({ email, shouldCreateUser: true })` sends the code. `supabase.auth.verifyOtp({ email, token, type: 'email' })` completes it.

**link mode**, attaching an email to an anonymous user who has guest workouts. `supabase.auth.updateUser({ email })` sends the code. `supabase.auth.verifyOtp({ email, token, type: 'email_change' })` completes it. Note the different `type`. Passing `'email'` here fails.

**The collision path.** If the email already belongs to another account, `updateUser` errors. Fall back to `signInWithOtp` against that email and verify with `type: 'email'`, which signs the user into the existing account and leaves the guest workouts behind. This is exactly what `completeWithIdToken` does today for `identity_already_exists`, and it must return the same `{ ok: true, linked: false, existingAccount: true }` outcome so `link-account.tsx` shows its existing alert unchanged.

Do not invent a new outcome type. `SignInOutcome` already covers every case this flow produces.

Mirror the existing guard: link mode refuses when the current session is not anonymous, with the same message the provider path uses.

## REPORT FIRST: the email_change double send

Supabase has a "Secure email change" setting under Authentication, Sign In / Providers, Email. When on, an email change sends a confirmation to both the old and the new address, and both must be confirmed.

An anonymous user has no old address, so the behaviour here is uncertain. Check the project's current setting with a read-only query or the management API if you can reach it, otherwise say so, and report what you expect `updateUser({ email })` to do on an anonymous user with that setting as it stands.

If it would require two confirmations, say so before building. The link flow would need a different approach and I want to know before the UI is written around it.

## Where the code lives

New file `apps/mobile/src/lib/email-sign-in.ts`, next to `native-sign-in.ts`, exporting:

- `sendEmailCode(email: string, mode: SignInMode): Promise<{ ok: true } | { ok: false; error: string }>`
- `verifyEmailCode(email: string, token: string, mode: SignInMode): Promise<SignInOutcome>`

Import `SignInMode` and `SignInOutcome` from `native-sign-in.ts` rather than redefining them. Keep the `__DEV__` branch logging pattern so the next test of the link flow can tell linked from existing from fresh without a database query.

Normalise the email with trim and lowercase before both calls. A code sent to one casing and verified against another fails.

## UI

`sign-in-screen.tsx` gains a third option below Google, above the guest button in `signIn` mode. Same `BUTTON_H`, same `radius.bar`, same width, so the three line up. Label "Continue with email".

Apple's guideline 4.8 wants Sign in with Apple at least as prominent as other options, so Apple stays first and nothing about its button changes.

Tapping it moves the screen to an email entry state, then to a code entry state. Do not push a new route. The screen is hosted three ways, as a plain route, as a native page sheet, and inside an RN Modal, and a push behaves differently in each. Keep it as local state inside `SignInContent`.

**Email entry.** One text input, `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`, `textContentType="emailAddress"`. A Continue button. Back returns to the provider buttons.

**Code entry.** One input, `keyboardType="number-pad"`, `textContentType="oneTimeCode"` so iOS offers the code from the notification. Show the address the code went to. A Resend button disabled for 60 seconds after each send, matching the project's minimum interval per user. A back control that returns to email entry so a typo is fixable.

Auto-submit when 6 digits are entered, and keep an explicit submit for the case where it fails and the user edits.

Errors go through the existing `message` line in the same red, no new pattern. Two worth handling by name: an expired or wrong code, and the rate limit.

The `busy` state is currently `'apple' | 'google' | 'guest' | null`. Extend it rather than adding a second loading flag.

In `link` mode the heading copy stays "Save your workouts" and the guest button stays hidden, both as they are now.

## Copy

No em dashes. No colons. Beginner-forward and plain.

- Email entry heading: "Sign in with email"
- Email entry lead: "We will send you a 6 digit code."
- Code entry lead: "Enter the code we sent to [address]."
- Resend, during cooldown: "Resend in Ns"
- Wrong code: "That code is not right. Check it and try again."
- Expired: "That code has expired. Send a new one."
- Rate limited: "Too many requests. Wait a minute and try again."

## DO NOT TOUCH

- Any schema.
- `native-sign-in.ts` beyond exporting types that already exist there. The Apple and Google paths are working and stay untouched.
- `auth-provider.tsx` beyond what is strictly needed.
- The `liftcamp://auth/callback` redirect URL or the `scheme` in `app.json`.
- Anonymous sign-in behaviour, captcha, or the onboarding gate.
- `apps/web`.
- Supabase dashboard settings and email templates. Report what is needed; do not change them.
- Do not merge the branch.

## Verify before reporting done

1. Typecheck passes with no new errors.
2. Signed out, email sign-in with a brand new address creates an account and lands on Home.
3. Signed out, email sign-in with an address that already has a web account reaches that account, and that account's existing workouts appear in History.
4. As an anonymous user with at least one logged workout, linking a new email keeps those workouts. Confirm by checking History after linking.
5. As an anonymous user, linking an email that already belongs to another account signs into that account and shows the existing alert about workouts not being moved.
6. A wrong code shows the wrong-code message and lets the user retry without starting over.
7. Resend is disabled for 60 seconds, then works.
8. The three buttons in `signIn` mode are the same height, radius, and width, and Apple is still first.
9. Light and dark both render correctly.
10. Report the exact `type` string passed to `verifyOtp` in each of the three paths, so the email_change distinction is on the record.
