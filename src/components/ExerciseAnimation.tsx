import { useState, type ReactNode } from "react";

// Two-frame exercise animation.
//
// free-exercise-db ships two photos per exercise, and they are not arbitrary:
// they are the START and END positions of the rep. Cross-fading between them on
// a loop reads as motion, which gives us an animation from data already in the
// catalog -- no new dependency, no paid asset library.
//
// Verified against the live catalog (2026-08-07):
//   - 875 of 886 exercises carry both frames (98.8%)
//   - every image is 850x567, and BOTH frames of a pair share those dimensions,
//     so they register exactly and the cross-fade dissolves pose-to-pose rather
//     than ghosting a shifted camera. aspect-[3/2] is therefore exact (1.4991).
//   - no row carries exactly one frame, so the single-image branch below is
//     defensive only.
//
// The animation itself is pure CSS (see .animate-rep-cycle in styles.css): no
// timer, no interval, no re-renders, and nothing to clean up when the drawer
// closes. React is used only to hold the fade until the second frame has
// actually decoded -- without that gate the first cycle fades to a blank box.
// Since 2026-09, 458 of the 898 catalog rows also carry a licensed ExerciseDB
// GIF in `gif_url`. Where one exists it replaces the cross-fade outright: it is
// a real recording of the movement rather than two poses dissolved into each
// other. The remaining 440 rows have no ExerciseDB equivalent (their library has
// no ab wheel rollout, no band pull-apart, no barbell hip thrust) and keep the
// two-frame treatment below, so both paths stay live indefinitely.
export function ExerciseAnimation({
  imageUrl,
  imageUrl2,
  gifUrl,
  alt,
  animated = true,
  loading = "eager",
  className = "mx-auto w-full max-w-[260px]",
  fallback = null,
}: {
  imageUrl?: string | null;
  imageUrl2?: string | null;
  /** Licensed ExerciseDB animation. Used only when `animated` is true, so list
   *  rows keep serving the static jpg and never autoplay a wall of GIFs. */
  gifUrl?: string | null;
  alt?: string;
  /** Row thumbnails pass false: the picker renders up to 200 rows and is not
   *  virtualised, so animating every one would mean ~400 full-size images and
   *  200 concurrent animations. Static frame 0 there, animation on expand. */
  animated?: boolean;
  /** "lazy" for list rows so offscreen thumbnails are never fetched. */
  loading?: "eager" | "lazy";
  className?: string;
  /** Rendered instead when the exercise has no imagery (8 catalog rows), so
   *  list rows keep their alignment. */
  fallback?: ReactNode;
}) {
  const [secondFrameReady, setSecondFrameReady] = useState(false);

  // No imagery at all (8 catalog rows). In the drawer this renders nothing and
  // the muscle diagrams carry the panel; list rows pass a fallback so the row
  // does not lose its left gutter.
  if (!imageUrl && !gifUrl) return <>{fallback}</>;

  // Licensed animation available: one <img>, no cross-fade, no ready-gate. The
  // GIF loops on its own, and prefers-reduced-motion is handled by the browser.
  //
  // Square, not 3:2. Every ExerciseDB asset is 360x360 (and 180x180 for the
  // small set), verified across all 1394. The free-exercise-db photos are
  // 850x567, which is where aspect-[3/2] below comes from -- reusing it here
  // with object-cover would crop ~33% of the height off a square source and
  // take the figure's head and feet with it.
  if (animated && gifUrl) {
    return (
      <div className={className}>
        <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
          <img
            src={gifUrl}
            alt={alt ? `${alt} demonstration` : ""}
            loading={loading}
            decoding="async"
            width={360}
            height={360}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (!imageUrl) return <>{fallback}</>;

  const animating = animated && Boolean(imageUrl2) && secondFrameReady;

  return (
    <div className={className}>
      <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-muted">
        {/* Frame 0 -- start position. Always visible underneath. */}
        <img
          src={imageUrl}
          alt={alt ? `${alt} demonstration` : ""}
          loading={loading}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Frame 1 -- end position. Fades in over the top on a loop. Decorative,
            since frame 0 already carries the alt text. */}
        {imageUrl2 && animated && (
          <img
            src={imageUrl2}
            alt=""
            aria-hidden="true"
            loading={loading}
            decoding="async"
            onLoad={() => setSecondFrameReady(true)}
            className={`absolute inset-0 h-full w-full object-cover opacity-0${
              animating ? " animate-rep-cycle" : ""
            }`}
          />
        )}
      </div>
    </div>
  );
}
