// Static frame-0 thumbnail for catalog list rows.
//
// Deliberately NOT ExerciseAnimation: that component cross-fades both frames,
// which is right when one exercise fills the screen and wrong in a list. The
// chest region page server-renders ~100 rows, so animating each would fetch
// ~200 full-size images and run 100 concurrent CSS animations on a page whose
// whole job is being a fast, crawlable index. The second frame stays on the
// detail page.
//
// Every catalog image is 850x567, so aspect-[3/2] is exact and no row shifts
// once the file decodes. `loading="lazy"` keeps rows below the fold off the
// network until they scroll near.
export function ExerciseThumb({
  imageUrl,
  alt,
  className = "w-[72px]",
}: {
  imageUrl: string | null;
  /** The exercise name. A row with no image renders no <img>, so a
   *  placeholder never carries alt text; the name stays in the link text. */
  alt?: string;
  className?: string;
}) {
  return (
    <span
      className={`block shrink-0 overflow-hidden rounded-md bg-muted ${className}`}
      aria-hidden={!imageUrl}
    >
      <span className="block aspect-[3/2]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            width={850}
            height={567}
            className="h-full w-full object-cover"
          />
        )}
      </span>
    </span>
  );
}
