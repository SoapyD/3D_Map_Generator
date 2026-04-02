/**
 * Shape-specific building list construction for the preview tool.
 *
 * Given parsed CLI args and an RNG, produces the list of building
 * descriptors that the preview pipeline will process.
 */

import { BUILDING } from '../config.js';
import { createBuilding } from './create-building.js';
import { buildCompositeShape } from './build-composite-shape.js';

export function buildBuildingsList(args, rng) {
  if (args.shape === 'diagA' || args.shape === 'diagB') {
    return buildDiagonalShape(args, rng);
  }

  if (args.shape.startsWith('lShape') || args.shape.startsWith('uShape') || args.shape.startsWith('uNarrow') || args.shape.startsWith('uSmall')) {
    return buildCompositeShape(args, rng);
  }

  const building = createBuilding(args.type, args.shape, args.tiers, rng);
  if (args.interiorWalls) building.interiorWalls = true;
  return [building];
}

function buildDiagonalShape(args, rng) {
  const base = createBuilding(args.type, 'full', args.tiers, rng);
  const hw = base.w / 2;
  const hd = base.d / 2;
  const hk2 = rng.pick(['short', 'medium', 'tall']);
  const h2 = BUILDING.heights[hk2];
  const mt2 = rng.int(Math.min(h2.tierMin, args.tiers), Math.min(h2.tierMax, args.tiers));

  if (args.shape === 'diagA') {
    return [
      { ...base, w: hw, d: hd, shape: 'full' },
      { x: base.x + hw, z: base.z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', pyramidRoof: false },
    ];
  }
  return [
    { x: base.x + hw, z: base.z, w: hw, d: hd, maxTier: base.maxTier, size: 'small', height: base.height, blockIndex: 0, shape: 'full', pyramidRoof: false },
    { x: base.x, z: base.z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', pyramidRoof: false },
  ];
}
