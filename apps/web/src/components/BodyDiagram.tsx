import {
  BODY_CROP,
  BODY_SOURCE,
  bodyHighlightsLabel,
  highlightsForView,
  type BodyHighlights,
  type BodyView,
} from "@liftcamp/shared";

type Props = {
  type: BodyView;
  /** From bodyHighlights; regions outside this view are ignored. */
  highlights: BodyHighlights;
  /** Load the layers at once, for a diagram at the top of the page. */
  eager?: boolean;
};

const BASE: Record<BodyView, string> = {
  anterior: "/muscles/base_front.webp",
  posterior: "/muscles/base_back.webp",
};

/**
 * The clay figure, front or back, with the worked muscles painted in. The
 * same drawing as the app's (apps/mobile/src/components/body-diagram.tsx).
 *
 * Layers, bottom to top: the base render, every secondary layer, every
 * primary layer. Each layer is a full 1024 WebP with the blue already
 * painted into the clay, registered to the base, so the diagram only
 * stacks them. The WebPs are made from the app's PNGs by
 * scripts/sync-muscle-layers.ts. All layers sit in one inner box scaled
 * and offset so the BODY_CROP box fills the container; scaling that box
 * rather than each layer keeps them registered to the base.
 */
export function BodyDiagram({ type, highlights, eager = false }: Props) {
  const view = highlightsForView(highlights, type);
  const loading = eager ? "eager" : "lazy";

  const inner: React.CSSProperties = {
    position: "absolute",
    left: `${(-BODY_CROP.x / BODY_CROP.width) * 100}%`,
    top: `${(-BODY_CROP.y / BODY_CROP.height) * 100}%`,
    width: `${(BODY_SOURCE / BODY_CROP.width) * 100}%`,
    height: `${(BODY_SOURCE / BODY_CROP.height) * 100}%`,
  };

  const layers = [
    BASE[type],
    ...view.secondary.map((r) => `/muscles/${r}_secondary.webp`),
    ...view.primary.map((r) => `/muscles/${r}_primary.webp`),
  ];

  return (
    <div
      role="img"
      aria-label={bodyHighlightsLabel(view)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${BODY_CROP.width} / ${BODY_CROP.height}`,
        overflow: "hidden",
      }}
    >
      <div style={inner} aria-hidden="true">
        {layers.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            width={BODY_SOURCE}
            height={BODY_SOURCE}
            loading={loading}
            decoding="async"
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          />
        ))}
      </div>
    </div>
  );
}
