import type { ImageSourcePropType } from 'react-native';

/**
 * The illustration for each comparison slug, 384px square PNGs with
 * transparency. Static requires, which is what Metro bundles, so the map
 * lives here rather than in shared next to the table. A slug with no entry
 * draws the card without a picture rather than a broken image.
 */
export const COMPARISON_ART: Record<string, ImageSourcePropType> = {
  'upright-piano': require('../../../assets/images/comparisons/upright-piano.png'),
  'vending-machine': require('../../../assets/images/comparisons/vending-machine.png'),
  horse: require('../../../assets/images/comparisons/horse.png'),
  cow: require('../../../assets/images/comparisons/cow.png'),
  'smart-car': require('../../../assets/images/comparisons/smart-car.png'),
  'grand-piano': require('../../../assets/images/comparisons/grand-piano.png'),
  sedan: require('../../../assets/images/comparisons/sedan.png'),
  hippo: require('../../../assets/images/comparisons/hippo.png'),
  'pickup-truck': require('../../../assets/images/comparisons/pickup-truck.png'),
  rhino: require('../../../assets/images/comparisons/rhino.png'),
  'delivery-van': require('../../../assets/images/comparisons/delivery-van.png'),
  elephant: require('../../../assets/images/comparisons/elephant.png'),
  trex: require('../../../assets/images/comparisons/trex.png'),
  'school-bus': require('../../../assets/images/comparisons/school-bus.png'),
  'garbage-truck': require('../../../assets/images/comparisons/garbage-truck.png'),
  'humpback-whale': require('../../../assets/images/comparisons/humpback-whale.png'),
  'semi-truck': require('../../../assets/images/comparisons/semi-truck.png'),
};
