import type { ReactNode } from "react";

/** The direct answer to the title question, in the first 100 words, above any
 *  preamble. Search snippets and AI answers pull from the top of the page, and
 *  a table of contents is not an answer. Every guide opens with one. */
export function AnswerBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-5 sm:p-6">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        The short version
      </p>
      <div className="mt-2 text-[17px] leading-[1.7] text-foreground lg:text-[18px]">
        {children}
      </div>
    </div>
  );
}
