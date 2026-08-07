import { useState, type ReactNode } from "react";

// Two-frame exercise animation.
//
// free-exercise-db ships two photos per exercise, and they are not arbitrary:
// they are the START and END positions of the rep. Cross-fading between them on
// a loop reads as motion, which gives us an animation from data already in the
// catalog -- no new dependency, no paid asset library.
//
// Verified against the live catalog (2026-08-07):
//   - 875 of 883 exercises carry both frames (99.1%)
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
export function ExerciseAnimation({
  imageUrl,
  imageUrl2,
  alt,
  animated = true,
  loading = "eager",
  className = "mx-auto w-full max-w-[260px]",
  fallback = null,
}: {
  imageUrl?: string | null;
  imageUrl2?: string | null;
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
