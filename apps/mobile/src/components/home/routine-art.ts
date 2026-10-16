import type { RoutineImageKey } from '@liftcamp/shared';

/**
 * The equipment illustrations, one per image key in shared's picker, from
 * assets/images/equipment/<key>.webp. Static requires, since Metro cannot
 * resolve a path built at runtime; each is the number Metro assigns.
 *
 * Sized to 3x the largest place each is drawn: 312 px for the four the
 * equipment tiles use (104 pt), 266 px for the rest (routine card art,
 * 88.4 pt). Lossy WebP with alpha at quality 85. The 1024 px PNG masters
 * are in assets-src/images/equipment, which nothing requires, so they are
 * not bundled.
 */
export const ROUTINE_ART: Record<RoutineImageKey, number> = {
  'leg-press': require('../../../assets/images/equipment/leg-press.webp'),
  'leg-curl': require('../../../assets/images/equipment/leg-curl.webp'),
  'chest-press': require('../../../assets/images/equipment/chest-press.webp'),
  'lat-pulldown': require('../../../assets/images/equipment/lat-pulldown.webp'),
  'power-rack': require('../../../assets/images/equipment/power-rack.webp'),
  'smith-machine': require('../../../assets/images/equipment/smith-machine.webp'),
  'adjustable-bench': require('../../../assets/images/equipment/adjustable-bench.webp'),
  'ez-bar': require('../../../assets/images/equipment/ez-bar.webp'),
  barbell: require('../../../assets/images/equipment/barbell.webp'),
  dumbbells: require('../../../assets/images/equipment/dumbbells.webp'),
  kettlebell: require('../../../assets/images/equipment/kettlebell.webp'),
  'cable-machine': require('../../../assets/images/equipment/cable-machine.webp'),
  'resistance-bands': require('../../../assets/images/equipment/resistance-bands.webp'),
  'bodyweight-mat': require('../../../assets/images/equipment/bodyweight-mat.webp'),
  'pull-up-bar': require('../../../assets/images/equipment/pull-up-bar.webp'),
  'dip-station': require('../../../assets/images/equipment/dip-station.webp'),
  chair: require('../../../assets/images/equipment/chair.webp'),
};
