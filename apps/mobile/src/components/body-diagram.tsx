import {
  BODY_CROP,
  BODY_SOURCE,
  bodyDiagramLabel,
  masksForView,
  PRIMARY_TINT,
  SECONDARY_TINT,
  type BodyView,
  type MuscleMask,
} from '@liftcamp/shared';
import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

/**
 * The clay figure, front or back, with the worked muscles tinted. Same
 * props as the web BodyDiagram.
 *
 * Layers, bottom to top: the base render, every secondary mask, every
 * primary mask. A mask is a white PNG whose shape is in its alpha, and the
 * core Image's tintColor recolours it while keeping that alpha, so no
 * native module is involved. All layers sit in one inner box scaled and
 * offset so the crop box fills the container; scaling that box rather than
 * each layer keeps the masks registered to the base.
 */
type Props = {
  type: BodyView;
  /** Frequency 2 and up is primary, 1 is secondary; a mask in both is primary. */
  data: { name: string; muscles: MuscleMask[]; frequency: number }[];
};

const BASES: Record<'front' | 'back', ImageSourcePropType> = {
  front: require('../../assets/images/muscles/base_front.png'),
  back: require('../../assets/images/muscles/base_back.png'),
};

/** Static requires, since Metro cannot resolve a path built at runtime. */
const MASKS: Record<MuscleMask, ImageSourcePropType> = {
  front_chest: require('../../assets/images/muscles/front_chest_mask.png'),
  front_delts: require('../../assets/images/muscles/front_delts_mask.png'),
  front_biceps: require('../../assets/images/muscles/front_biceps_mask.png'),
  front_forearms: require('../../assets/images/muscles/front_forearms_mask.png'),
  front_abs: require('../../assets/images/muscles/front_abs_mask.png'),
  front_quads: require('../../assets/images/muscles/front_quads_mask.png'),
  front_adductors: require('../../assets/images/muscles/front_adductors_mask.png'),
  back_traps: require('../../assets/images/muscles/back_traps_mask.png'),
  back_rear_delts: require('../../assets/images/muscles/back_rear_delts_mask.png'),
  back_upper_back: require('../../assets/images/muscles/back_upper_back_mask.png'),
  back_lats: require('../../assets/images/muscles/back_lats_mask.png'),
  back_lower_back: require('../../assets/images/muscles/back_lower_back_mask.png'),
  back_triceps: require('../../assets/images/muscles/back_triceps_mask.png'),
  back_forearms: require('../../assets/images/muscles/back_forearms_mask.png'),
  back_glutes: require('../../assets/images/muscles/back_glutes_mask.png'),
  back_abductors: require('../../assets/images/muscles/back_abductors_mask.png'),
  back_hamstrings: require('../../assets/images/muscles/back_hamstrings_mask.png'),
  back_calves: require('../../assets/images/muscles/back_calves_mask.png'),
};

export function BodyDiagram({ type, data }: Props) {
  const [width, setWidth] = useState(0);

  const primary = new Set<MuscleMask>();
  const secondary = new Set<MuscleMask>();
  for (const entry of data) {
    for (const m of entry.muscles) (entry.frequency >= 2 ? primary : secondary).add(m);
  }
  for (const m of primary) secondary.delete(m);

  const primaryMasks = masksForView([...primary], type);
  const secondaryMasks = masksForView([...secondary], type);

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
      accessibilityLabel={bodyDiagramLabel(primaryMasks, secondaryMasks)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.frame}>
      {width > 0 ? (
        <View style={[styles.inner, inner]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Image source={BASES[type === 'anterior' ? 'front' : 'back']} style={styles.layer} />
          {secondaryMasks.map((m) => (
            <Image key={m} source={MASKS[m]} style={[styles.layer, { tintColor: SECONDARY_TINT }]} />
          ))}
          {primaryMasks.map((m) => (
            <Image key={m} source={MASKS[m]} style={[styles.layer, { tintColor: PRIMARY_TINT }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: BODY_CROP.width / BODY_CROP.height, overflow: 'hidden' },
  inner: { position: 'absolute' },
  layer: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});
