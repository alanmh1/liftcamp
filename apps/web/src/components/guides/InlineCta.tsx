import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";

/** A mid-article nudge. Guides that end without a next step convert nobody, and
 *  a reader is most persuadable right after the paragraph that told them what to
 *  do. One per guide, placed mid-body — not a banner, not a modal. */
export function InlineCta({
  title = "Log this workout in LiftCamp",
  body = "LiftCamp is a free workout tracker that runs on your phone. Log your sets at the gym, and next session it shows you last week's weights so you know what to add.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <aside className="mt-8 max-w-[68ch] rounded-xl border border-border bg-secondary/40 p-5">
      <p className="text-[17px] font-semibold tracking-tight lg:text-[18px]">{title}</p>
      <p className="mt-1.5 text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
        {body}
      </p>
      <AppStoreBadge tone="black" height={44} campaign="guide-inline" className="mt-3" />
      <AndroidNotify source="cta" />
    </aside>
  );
}
