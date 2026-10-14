import { cn } from "@/lib/utils";

export const CLAY_SHAPES = ["blob", "pill", "ring", "stack", "arch", "dots"] as const;
export type ClayShapeKind = (typeof CLAY_SHAPES)[number];
export type GuideTone = "getting-started" | "programming" | "technique";

/** The tone key for a guide's category label. */
export function guideTone(category: string): GuideTone {
  return category === "Getting started"
    ? "getting-started"
    : category === "Technique"
      ? "technique"
      : "programming";
}

/**
 * Placeholder clay illustration. Soft inner highlight and shade on a token color,
 * to be swapped for the real clay renders later.
 */
const clay =
  "shadow-[inset_-6px_-8px_14px_color-mix(in_oklab,var(--foreground)_18%,transparent),inset_6px_8px_14px_color-mix(in_oklab,var(--popover)_70%,transparent),0_12px_20px_-10px_color-mix(in_oklab,var(--foreground)_35%,transparent)]";

export function ClayShape({
  shape,
  tone,
  className,
}: {
  shape: ClayShapeKind;
  tone: GuideTone;
  className?: string;
}) {
  return (
    <div
      data-tone={tone}
      aria-hidden="true"
      className={cn("group/clay relative flex items-center justify-center", className)}
    >
      {shape === "blob" && (
        <>
          <span
            className={cn(
              "h-20 w-24 rounded-[46%_54%_42%_58%] bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span
            className={cn("absolute right-[30%] top-[22%] h-8 w-8 rounded-full bg-popover", clay)}
          />
        </>
      )}
      {shape === "pill" && (
        <>
          <span
            className={cn(
              "h-10 w-28 -rotate-12 rounded-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span
            className={cn(
              "absolute h-14 w-14 translate-x-10 translate-y-4 rounded-full bg-popover",
              clay,
            )}
          />
        </>
      )}
      {shape === "ring" && (
        <span
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
            clay,
          )}
        >
          <span className={cn("h-10 w-10 rounded-full bg-muted", clay)} />
        </span>
      )}
      {shape === "stack" && (
        <span className="flex items-end gap-ds-xs">
          <span className={cn("h-10 w-7 rounded-md bg-popover", clay)} />
          <span
            className={cn(
              "h-16 w-7 rounded-md bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span
            className={cn(
              "h-24 w-7 rounded-md bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
        </span>
      )}
      {shape === "arch" && (
        <>
          <span
            className={cn(
              "h-16 w-28 rounded-t-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span className={cn("absolute bottom-[18%] h-8 w-10 rounded-t-full bg-muted", clay)} />
        </>
      )}
      {shape === "dots" && (
        <span className="grid grid-cols-3 gap-ds-sm">
          <span
            className={cn(
              "h-7 w-7 rounded-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span className={cn("h-7 w-7 rounded-full bg-popover", clay)} />
          <span
            className={cn(
              "h-7 w-7 rounded-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span className={cn("h-7 w-7 rounded-full bg-popover", clay)} />
          <span
            className={cn(
              "h-7 w-7 rounded-full bg-primary group-data-[tone=getting-started]/clay:bg-pr group-data-[tone=technique]/clay:bg-warning",
              clay,
            )}
          />
          <span className={cn("h-7 w-7 rounded-full bg-popover", clay)} />
        </span>
      )}
    </div>
  );
}
