import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Consistent back affordance for every deeper screen: a real 44px icon+label
// target rather than a small underlined text link.
export function BackLink({
  label = "Back",
  className,
  ...linkProps
}: { label?: string; className?: string } & LinkProps) {
  return (
    <Link
      {...(linkProps as LinkProps)}
      aria-label={label}
      className={cn(
        "-ml-2 inline-flex h-11 min-w-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground",
        "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
