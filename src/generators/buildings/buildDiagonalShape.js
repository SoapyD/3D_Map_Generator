import { BUILDING } from '../../config.js';

const HEIGHTS = BUILDING.heights;

/**
 * Build a diagonal shape: two independent single-quadrant buildings.
 * Returns an array of building objects to push.
 */
export function buildDiagonalShape(shape, x, z, w, d, maxTier, heightKey, tiers, rng, startIndex) {
  const groupId = startIndex; // all parts share this texture group
  const hw = w / 2;
  const hd = d / 2;
  const hk2 = rng.pick(['short', 'medium', 'tall']);
  const h2 = HEIGHTS[hk2];
  const mt2 = rng.int(Math.min(h2.tierMin, tiers), Math.min(h2.tierMax, tiers));

  if (shape === 'diagA') {
    return [
      { x, z, w: hw, d: hd, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId },
      { x: x + hw, z: z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', textureGroup: groupId },
    ];
  } else {
    return [
      { x: x + hw, z, w: hw, d: hd, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId },
      { x, z: z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', textureGroup: groupId },
    ];
  }
}
