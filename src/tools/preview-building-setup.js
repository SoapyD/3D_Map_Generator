/**
 * Building Preview — Setup & Construction
 *
 * Contains argument parsing and building creation logic
 * for the preview-building tool.
 */

import { BUILDING } from '../config.js';

function parsePreviewArgs(argv) {
  const args = {
    type: 'small',
    shape: 'full',
    seed: 42,
    tiers: 4,
    interiorWalls: false,
    textureSet: 'base',
    debug: false,
    format: 'both',  // 'glb', 'obj', 'both'
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) args.type = argv[++i];
    else if (arg === '--shape' && argv[i + 1]) args.shape = argv[++i];
    else if (arg === '--seed' && argv[i + 1]) args.seed = parseInt(argv[++i]);
    else if (arg === '--tiers' && argv[i + 1]) args.tiers = parseInt(argv[++i]);
    else if (arg === '--interior-walls') args.interiorWalls = true;
    else if (arg === '--format' && argv[i + 1]) args.format = argv[++i];
    else if (arg === '--glb') args.format = 'glb';
    else if (arg === '--obj') args.format = 'obj';
    else if (arg === '--texture-set' && argv[i + 1]) args.textureSet = argv[++i];
    else if (arg === '--debug') args.debug = true;
  }

  return args;
}

function createBuilding(type, shape, tiers, rng) {
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

export { parsePreviewArgs, createBuilding };
