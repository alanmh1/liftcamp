import {
  BODY_CROP,
  BODY_SOURCE,
  bodyDiagramLabel,
  masksForView,
  PRIMARY_TINT,
  SECONDARY_TINT,
  type BodyView,
  type MuscleMask,
} from "@liftcamp/shared";

type Props = {
  type: BodyView;
  /** Frequency 2 and up is primary, 1 is secondary; a mask in both is primary. */
  data: { name: string; muscles: MuscleMask[]; frequency: number }[];
};

/**
 * The clay figure, front or back, with the worked muscles tinted.
 *
 * Layers, bottom to top: the base render, every secondary mask, every
 * primary mask. A mask is a white image whose shape is in its alpha, so it
 * is drawn as a tinted div with the image as its CSS mask. The web serves
 * WebP (lossy bases, lossless masks); mobile keeps the PNGs. All layers sit in one
 * inner box scaled and offset so the crop box fills the container; scaling
 * that box rather than each layer keeps the masks registered to the base.
 */
export function BodyDiagram({ type, data }: Props) {
  const primary = new Set<MuscleMask>();
  const secondary = new Set<MuscleMask>();
  for (const entry of data) {
    for (const m of entry.muscles) (entry.frequency >= 2 ? primary : secondary).add(m);
  }
  for (const m of primary) secondary.delete(m);

  const view = type === "anterior" ? "front" : "back";
  const primaryMasks = masksForView([...primary], type);
  const secondaryMasks = masksForView([...secondary], type);

  const scale = BODY_SOURCE / BODY_CROP.width;
  const inner: React.CSSProperties = {
    position: "absolute",
    left: `${(-BODY_CROP.x / BODY_CROP.width) * 100}%`,
    top: `${(-BODY_CROP.y / BODY_CROP.height) * 100}%`,
    width: `${scale * 100}%`,
    height: `${(BODY_SOURCE / BODY_CROP.height) * 100}%`,
  };

  return (
    <div
      role="img"
      aria-label={bodyDiagramLabel(primaryMasks, secondaryMasks)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${BODY_CROP.width} / ${BODY_CROP.height}`,
        overflow: "hidden",
      }}
    >
      <div style={inner} aria-hidden="true">
        <img
          src={`/muscles/base_${view}.webp`}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        />
        {secondaryMasks.map((m) => (
          <MaskLayer key={m} mask={m} tint={SECONDARY_TINT} />
        ))}
        {primaryMasks.map((m) => (
          <MaskLayer key={m} mask={m} tint={PRIMARY_TINT} />
        ))}
      </div>
    </div>
  );
}

function MaskLayer({ mask, tint }: { mask: MuscleMask; tint: string }) {
  const url = `url(/muscles/${mask}_mask.webp)`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: tint,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
