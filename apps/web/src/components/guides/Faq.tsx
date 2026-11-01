/** Visible FAQ for a guide. Rendered from the same list the route emits as
 *  FAQPage JSON-LD, so the markup and the page can never disagree. Answers are
 *  plain strings for that reason: links belong in the body sections. */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <>
      {items.map((it) => (
        <div key={it.q}>
          <h3 className="mt-6 text-[17px] font-semibold tracking-tight lg:text-[18px]">{it.q}</h3>
          <p className="mt-2 text-foreground/80">{it.a}</p>
        </div>
      ))}
    </>
  );
}
