import { Link } from "@tanstack/react-router";

/** A one-line pointer from a guide to the routine builder. Deliberately lighter
 *  than InlineCta: a guide should carry one signup ask, not two, and this one
 *  sends the reader to a free tool rather than to a sign-up form. */
export function BuilderLink({
  label = "Build your own routine free",
  body = "Pick your lifts from the library, put them in order, and keep the plan. No account needed to start.",
  muscle,
}: {
  label?: string;
  body?: string;
  muscle?: string;
}) {
  return (
    <p className="mt-6 max-w-[68ch] rounded-lg border-l-2 border-primary bg-secondary/40 py-3 pl-4 pr-3 text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
      <Link
        to="/routines/build"
        search={muscle ? { muscle } : {}}
        className="font-semibold text-foreground underline underline-offset-4"
      >
        {label}
      </Link>{" "}
      — {body}
    </p>
  );
}
