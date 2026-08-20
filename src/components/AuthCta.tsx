import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Marketing CTAs are read by two very different people: a stranger, who needs a
 * signup, and a signed-in lifter who wandered into a guide from search. Sending
 * the second one to /login is a dead end — the login route bounces them
 * straight back out. This routes the same CTA by session state.
 */
export function useAuthCta(): { signedIn: boolean } {
  const { session } = useAuth();
  return { signedIn: !!session };
}

export function AuthCta({
  signedOutLabel = "Create a free account",
  signedInLabel = "Open LiftCamp",
  className,
}: {
  signedOutLabel?: string;
  signedInLabel?: string;
  className?: string;
}) {
  const { signedIn } = useAuthCta();

  if (signedIn) {
    return (
      <Link to="/" className={cn(className)}>
        {signedInLabel}
      </Link>
    );
  }

  return (
    <Link to="/login" search={{ mode: "signup" }} className={cn(className)}>
      {signedOutLabel}
    </Link>
  );
}
