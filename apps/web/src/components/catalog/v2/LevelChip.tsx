/** Difficulty chip on the library cards. `level` is the raw column value
 *  ("beginner", "intermediate", "expert"); the label is title-cased. */
export function LevelChip({ level }: { level: string | null }) {
  if (!level) return null;
  return (
    <span
      data-level={level}
      className="rounded-full bg-muted px-ds-sm py-ds-xs font-caption text-caption text-foreground data-[level=beginner]:bg-pr/60 data-[level=beginner]:text-pr-foreground data-[level=expert]:bg-foreground data-[level=expert]:text-background"
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}
