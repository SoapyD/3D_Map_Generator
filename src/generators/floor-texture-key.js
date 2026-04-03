import { getTexGroup } from './geometry-helpers/getTexGroup.js';

/**
 * Determine floor texture key for a building.
 */
export function floorTextureKey(bi, buildings) {
  if (bi < 0) return 'floor:building:0';
  const ti = getTexGroup(bi, buildings);
  return `floor:building:${ti}`;
}
