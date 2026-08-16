import type { ReactNode } from "react";

/** Beginner warning or aside. Distinct from AnswerBlock: that one is the page's
 *  answer, this one interrupts the body. Only two tones, because a third
 *  invites decoration. */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warning";
  title: string;
  children: ReactNode;
}) {
  const accent = tone === "warning" ? "border-l-destructive" : "border-l-primary";
  return (
    <aside className={`mt-6 rounded-r-lg border-l-[3px] ${accent} bg-secondary/30 py-4 pl-4 pr-5`}>
      <p className="text-[15px] font-semibold">{title}</p>
      <div className="mt-1 text-[16px] leading-relaxed text-muted-foreground">{children}</div>
    </aside>
  );
}
