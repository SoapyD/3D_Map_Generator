import { BUILDING } from '../config.js';

/**
 * Create a building descriptor for the preview tool.
 */
export function createBuilding(type, shape, tiers, rng) {
  const fp = BUILDING.footprints[type] || BUILDING.footprints.small;

  let w, d, maxTier, size;

  switch (type) {
    case 'tower': {
      const tFp = BUILDING.footprints.tower || { min: 2, max: 3 };
      w = rng.float(tFp.min, tFp.max);
      d = rng.float(tFp.min, tFp.max);
      maxTier = tiers;
      size = 'tower';
      break;
    }
    case 'large':
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      maxTier = rng.int(3, Math.min(5, tiers));
      size = 'large';
      break;
    case 'medium':
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      maxTier = rng.int(2, Math.min(4, tiers));
      size = 'medium';
      break;
    default: // small
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      const heightKey = rng.pick(['short', 'medium', 'tall']);
      const height = BUILDING.heights[heightKey];
      maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));
      size = 'small';
      break;
  }

  // Centre the building with some margin
  const margin = 2;
  const x = margin;
  const z = margin;

  const pyramidRoof = (size === 'tower') && rng.chance(BUILDING.pyramidRoofChance);

  // Determine shape — use specified shape or pick randomly for small buildings
  let buildingShape = 'full';
  if (size === 'small') {
    if (shape !== 'full' && BUILDING.shapes && BUILDING.shapes[shape]) {
      buildingShape = shape;
    } else if (shape === 'random') {
      // Pick a random non-full shape
      const shapeNames = Object.keys(BUILDING.shapes).filter(s => s !== 'full');
      buildingShape = rng.pick(shapeNames);
    } else {
      buildingShape = shape;
    }
  }

  return { x, z, w, d, maxTier, size, height: 'tall', blockIndex: 0, pyramidRoof, shape: buildingShape, interiorWalls: undefined };
}
