import { AuthCta } from "@/components/AuthCta";

/** A mid-article nudge. Guides that end without a next step convert nobody, and
 *  a reader is most persuadable right after the paragraph that told them what to
 *  do. One per guide, placed mid-body — not a banner, not a modal. */
export function InlineCta({
  title = "Log this workout in LiftCamp",
  body = "LiftCamp is a free workout tracker that runs on your phone. Log your sets at the gym, and next session it shows you last week's weights so you know what to add.",
  label = "Start tracking free",
}: {
  title?: string;
  body?: string;
  label?: string;
}) {
  return (
    <aside className="mt-8 max-w-[68ch] rounded-xl border border-border bg-secondary/40 p-5">
      <p className="text-[17px] font-semibold tracking-tight lg:text-[18px]">{title}</p>
      <p className="mt-1.5 text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
        {body}
      </p>
      <AuthCta
        signedOutLabel={label}
        signedInLabel="Open LiftCamp"
        className="mt-3 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        No card, no app store. Works in your browser.
      </p>
    </aside>
  );
}
