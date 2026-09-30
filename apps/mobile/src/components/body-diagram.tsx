import {
  BODY_CROP,
  BODY_SOURCE,
  bodyHighlightsLabel,
  circleCrop,
  highlightsForView,
  type BodyHighlights,
  type BodyRegion,
  type BodyView,
  type LayerBox,
} from '@liftcamp/shared';
import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import bounds from '../../assets/images/muscles/bounds.json';

/**
 * The clay figure, front or back, with the worked muscles painted in.
 *
 * Layers, bottom to top: the base render, every secondary layer, every
 * primary layer. Each layer is a full 1024 PNG with the blue already
 * painted into the clay, registered to the base, so the diagram only
 * stacks them. All layers sit in one inner box scaled and offset so the
 * crop fills the frame; scaling that box rather than each layer
 * keeps them registered to the base.
 *
 * BodyDiagram is the whole figure (the Exercises tab exercise screen).
 * BodyDiagramCircle zooms to the lit muscles (the exercise info sheet).
 */

type Props = {
  type: BodyView;
  /** From bodyHighlights; regions outside this view are ignored. */
  highlights: BodyHighlights;
};

const BASES: Record<BodyView, ImageSourcePropType> = {
  anterior: require('../../assets/images/muscles/base_front.png'),
  posterior: require('../../assets/images/muscles/base_back.png'),
};

type Level = 'primary' | 'secondary';

/** Static requires, since Metro cannot resolve a path built at runtime. */
const LAYERS: Record<BodyRegion, Record<Level, ImageSourcePropType>> = {
  front_chest: {
    primary: require('../../assets/images/muscles/front_chest_primary.png'),
    secondary: require('../../assets/images/muscles/front_chest_secondary.png'),
  },
  front_delts: {
    primary: require('../../assets/images/muscles/front_delts_primary.png'),
    secondary: require('../../assets/images/muscles/front_delts_secondary.png'),
  },
  front_biceps: {
    primary: require('../../assets/images/muscles/front_biceps_primary.png'),
    secondary: require('../../assets/images/muscles/front_biceps_secondary.png'),
  },
  front_forearms: {
    primary: require('../../assets/images/muscles/front_forearms_primary.png'),
    secondary: require('../../assets/images/muscles/front_forearms_secondary.png'),
  },
  front_abs: {
    primary: require('../../assets/images/muscles/front_abs_primary.png'),
    secondary: require('../../assets/images/muscles/front_abs_secondary.png'),
  },
  front_quads: {
    primary: require('../../assets/images/muscles/front_quads_primary.png'),
    secondary: require('../../assets/images/muscles/front_quads_secondary.png'),
  },
  front_adductors: {
    primary: require('../../assets/images/muscles/front_adductors_primary.png'),
    secondary: require('../../assets/images/muscles/front_adductors_secondary.png'),
  },
  back_traps: {
    primary: require('../../assets/images/muscles/back_traps_primary.png'),
    secondary: require('../../assets/images/muscles/back_traps_secondary.png'),
  },
  back_rear_delts: {
    primary: require('../../assets/images/muscles/back_rear_delts_primary.png'),
    secondary: require('../../assets/images/muscles/back_rear_delts_secondary.png'),
  },
  back_lats: {
    primary: require('../../assets/images/muscles/back_lats_primary.png'),
    secondary: require('../../assets/images/muscles/back_lats_secondary.png'),
  },
  back_lower_back: {
    primary: require('../../assets/images/muscles/back_lower_back_primary.png'),
    secondary: require('../../assets/images/muscles/back_lower_back_secondary.png'),
  },
  back_triceps: {
    primary: require('../../assets/images/muscles/back_triceps_primary.png'),
    secondary: require('../../assets/images/muscles/back_triceps_secondary.png'),
  },
  back_forearms: {
    primary: require('../../assets/images/muscles/back_forearms_primary.png'),
    secondary: require('../../assets/images/muscles/back_forearms_secondary.png'),
  },
  back_glutes: {
    primary: require('../../assets/images/muscles/back_glutes_primary.png'),
    secondary: require('../../assets/images/muscles/back_glutes_secondary.png'),
  },
  back_abductors: {
    primary: require('../../assets/images/muscles/back_abductors_primary.png'),
    secondary: require('../../assets/images/muscles/back_abductors_secondary.png'),
  },
  back_hamstrings: {
    primary: require('../../assets/images/muscles/back_hamstrings_primary.png'),
    secondary: require('../../assets/images/muscles/back_hamstrings_secondary.png'),
  },
  back_calves: {
    primary: require('../../assets/images/muscles/back_calves_primary.png'),
    secondary: require('../../assets/images/muscles/back_calves_secondary.png'),
  },
};

/** Alpha boxes from bounds.json, keyed by file name without the extension. */
const BOUNDS: Record<string, number[] | undefined> = bounds.layers;

function layerBox(region: BodyRegion, level: Level): LayerBox | undefined {
  return BOUNDS[`${region}_${level}`] as LayerBox | undefined;
}

/** The base and the lit layers, each filling the parent, which stands for the 1024 canvas. */
function Layers({ type, highlights }: Props) {
  return (
    <>
      <Image source={BASES[type]} style={styles.layer} />
      {highlights.secondary.map((r) => (
        <Image key={r} source={LAYERS[r].secondary} style={styles.layer} />
      ))}
      {highlights.primary.map((r) => (
        <Image key={r} source={LAYERS[r].primary} style={styles.layer} />
      ))}
    </>
  );
}

/** The whole figure, cropped to BODY_CROP, as wide as its container. */
export function BodyDiagram({ type, highlights }: Props) {
  const [width, setWidth] = useState(0);
  const view = highlightsForView(highlights, type);

  // The crop box fills the container, so one source pixel is this many
  // points, and every layer is the full source square placed by that.
  const scale = width / BODY_CROP.width;
  const inner = {
    left: -BODY_CROP.x * scale,
    top: -BODY_CROP.y * scale,
    width: BODY_SOURCE * scale,
    height: BODY_SOURCE * scale,
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={bodyHighlightsLabel(view)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.frame}>
      {width > 0 ? (
        <View style={[styles.inner, inner]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Layers type={type} highlights={view} />
        </View>
      ) : null}
    </View>
  );
}

/** Whether a view has any lit region, so a host can skip its circle. */
export function viewHasHighlights(highlights: BodyHighlights, type: BodyView): boolean {
  const view = highlightsForView(highlights, type);
  return view.primary.length + view.secondary.length > 0;
}

/**
 * The figure in a circle, zoomed to the union of the view's lit layers plus
 * padding, with a cap on the zoom so a small muscle keeps its surroundings
 * (see circleCrop). Renders nothing when the view has no lit region.
 */
export function BodyDiagramCircle({
  type,
  highlights,
  size,
  background,
}: Props & { size: number; background: string }) {
  const view = highlightsForView(highlights, type);
  const boxes = [
    ...view.primary.map((r) => layerBox(r, 'primary')),
    ...view.secondary.map((r) => layerBox(r, 'secondary')),
  ].filter((b) => b != null);
  const crop = circleCrop(boxes, BODY_SOURCE);
  if (!crop) return null;

  const scale = size / crop.diameter;
  const inner = {
    left: -(crop.cx - crop.diameter / 2) * scale,
    top: -(crop.cy - crop.diameter / 2) * scale,
    width: BODY_SOURCE * scale,
    height: BODY_SOURCE * scale,
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={bodyHighlightsLabel(view)}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <View style={[styles.inner, inner]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Layers type={type} highlights={view} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: BODY_CROP.width / BODY_CROP.height, overflow: 'hidden' },
  circle: { overflow: 'hidden' },
  inner: { position: 'absolute' },
  layer: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});
