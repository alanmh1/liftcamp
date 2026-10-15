import { cn } from "@/lib/utils";

/**
 * A real App Store screenshot (iPhone 17 Pro Max, 1320x2868) in a simple
 * iPhone frame. Files are WebP at 360, 540 and 720 wide in
 * public/screenshots, named `<name>-<width>.webp`.
 */
export function PhoneShot({
  name,
  alt,
  className,
  priority = false,
}: {
  name: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[1320/2868] w-[300px] overflow-hidden rounded-[48px] border-[10px] border-foreground bg-background shadow-2xl shadow-primary/25",
        className,
      )}
    >
      <img
        src={`/screenshots/${name}-540.webp`}
        srcSet={[360, 540, 720].map((w) => `/screenshots/${name}-${w}.webp ${w}w`).join(", ")}
        sizes="300px"
        alt={alt}
        width={1320}
        height={2868}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className="h-full w-full rounded-[38px] object-cover object-top"
      />
    </div>
  );
}
