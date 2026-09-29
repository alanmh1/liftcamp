import { SignInScreen } from '@/components/sign-in-screen';

/**
 * Shown when onboarding is complete but there is no session (signed out).
 * The only place the subtitle rotates; the onboarding modal and
 * link-account keep their own copy.
 */
export default function SignInRoute() {
  return <SignInScreen rotatingLead />;
}
