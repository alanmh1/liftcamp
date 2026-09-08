import type { ReactNode } from "react";

/** Body typography for guides. 68ch rather than the catalog's 62ch: long-form
 *  prose reads better slightly wider than a list intro. Deliberate, and the
 *  only place the wider measure is used. */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-[68ch] text-[17px] leading-[1.7] lg:text-[18px]">{children}</div>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-foreground/80">{children}</p>;
}

/** id feeds the table of contents and scroll-mt clears the sticky header. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}
