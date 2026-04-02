import { getTexGroup } from './get-tex-group.js';

/**
 * Determine wall texture category based on building size.
 */
export function wallTextureKey(bi, buildings) {
  if (bi < 0) return 'wall:landmark:0';
  const b = buildings[bi];
  const ti = getTexGroup(bi, buildings);
  if (b.size === 'medium' || b.size === 'large') {
    return `wall:landmark:${ti}`;
  }
  return `wall:standard:${ti}`;
}
