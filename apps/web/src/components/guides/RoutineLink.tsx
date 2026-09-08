import { Link } from "@tanstack/react-router";

/** A pointer from a guide to a published routine. Same weight as BuilderLink,
 *  different destination: the builder is for someone who wants to choose, this
 *  is for someone who wants a plan handed to them. The label is written per
 *  use so the anchor text describes the routine rather than saying "here". */
export function RoutineLink({
  slug,
  label,
  body,
}: {
  slug: string;
  label: string;
  body: string;
}) {
  return (
    <p className="mt-6 max-w-[68ch] rounded-lg border-l-2 border-primary bg-secondary/40 py-3 pl-4 pr-3 text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
      <Link
        to="/routines/$slug"
        params={{ slug }}
        className="font-semibold text-foreground underline underline-offset-4"
      >
        {label}
      </Link>{" "}
      — {body}
    </p>
  );
}
