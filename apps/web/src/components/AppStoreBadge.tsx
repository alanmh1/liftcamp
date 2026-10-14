import { appStoreUrl } from "@liftcamp/shared";
import { cn } from "@/lib/utils";

/**
 * Apple's official "Download on the App Store" badge, unmodified, from
 * toolbox.marketingtools.apple.com. Apple's rules: 40px tall at minimum on
 * screen, clear space of a quarter of its height, black preferred, white only
 * where black looks heavy, never redrawn or recoloured.
 *
 * `tone="auto"` follows the app theme (black on light, white on dark). The
 * marketing pages are light only and pass "black".
 */
export function AppStoreBadge({
  tone = "auto",
  height = 48,
  className,
  campaign,
}: {
  tone?: "auto" | "black" | "white";
  height?: number;
  className?: string;
  campaign?: string;
}) {
  // The artwork is 119.66 x 40.
  const width = Math.round((height * 119.66407) / 40);
  const img = (src: string, extra?: string) => (
    <img
      src={src}
      alt="Download on the App Store"
      width={width}
      height={height}
      className={cn("block", extra)}
      style={{ width, height }}
    />
  );

  return (
    <a
      href={appStoreUrl(campaign)}
      className={cn("inline-block shrink-0 leading-none", className)}
      aria-label="Download LiftCamp on the App Store"
    >
      {tone === "black" && img("/badges/app-store-black.svg")}
      {tone === "white" && img("/badges/app-store-white.svg")}
      {tone === "auto" && (
        <>
          {img("/badges/app-store-black.svg", "dark:hidden")}
          {img("/badges/app-store-white.svg", "hidden dark:block")}
        </>
      )}
    </a>
  );
}
