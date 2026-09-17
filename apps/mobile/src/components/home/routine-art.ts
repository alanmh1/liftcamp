import type { RoutineImageKey } from '@liftcamp/shared';
import type { ImageSourcePropType } from 'react-native';

/**
 * The equipment illustrations, one per image key in shared's picker, from
 * assets/images/equipment/<key>.png. Static requires, since Metro cannot
 * resolve a path built at runtime. 1024 square RGBA clay renders (three
 * at 384 from an earlier batch).
 */
export const ROUTINE_ART: Record<RoutineImageKey, ImageSourcePropType> = {
  'leg-press': require('../../../assets/images/equipment/leg-press.png'),
  'leg-curl': require('../../../assets/images/equipment/leg-curl.png'),
  'chest-press': require('../../../assets/images/equipment/chest-press.png'),
  'lat-pulldown': require('../../../assets/images/equipment/lat-pulldown.png'),
  'power-rack': require('../../../assets/images/equipment/power-rack.png'),
  'smith-machine': require('../../../assets/images/equipment/smith-machine.png'),
  'adjustable-bench': require('../../../assets/images/equipment/adjustable-bench.png'),
  'ez-bar': require('../../../assets/images/equipment/ez-bar.png'),
  barbell: require('../../../assets/images/equipment/barbell.png'),
  dumbbells: require('../../../assets/images/equipment/dumbbells.png'),
  kettlebell: require('../../../assets/images/equipment/kettlebell.png'),
  'cable-machine': require('../../../assets/images/equipment/cable-machine.png'),
  'resistance-bands': require('../../../assets/images/equipment/resistance-bands.png'),
  'bodyweight-mat': require('../../../assets/images/equipment/bodyweight-mat.png'),
};
