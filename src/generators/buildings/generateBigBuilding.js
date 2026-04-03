import { BUILDING } from '../../config.js';
import { pickShape } from './pickShape.js';
import { buildBigLShape } from './buildBigLShape.js';
import { buildBigNarrowU } from './buildBigNarrowU.js';
import { buildBigUShape } from './buildBigUShape.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Generate a single big building (possibly composite) at a given position.
 * Returns an array of building segments (1 for 'full', 2-3 for L/U shapes).
 */
export function generateBigBuilding(sizeKey, pos, config, maxTiers, rng) {
  const mw = config.mapWidth;
  const md = config.mapDepth;
  const margin = 2;

  const fp = FOOTPRINTS[sizeKey];
  const w = rng.float(fp.min, fp.max);
  const d = rng.float(fp.min, fp.max);
  const x = Math.max(margin, Math.min(pos.x - w / 2, mw - w - margin));
  const z = Math.max(margin, Math.min(pos.z - d / 2, md - d - margin));
  const maxTier = rng.int(3, Math.min(5, maxTiers));
  const shape = pickShape(rng, sizeKey);

  if (shape === 'full') {
    return [{ x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full' }];
  }

  const segW = rng.float(fp.min / 2, fp.max / 2);
  const segD = rng.float(fp.min / 2, fp.max / 2);
  let results;

  if (shape.startsWith('lShape')) {
    results = buildBigLShape(shape, x, z, segW, segD, maxTier, sizeKey);
  } else if (shape.startsWith('uNarrow')) {
    results = buildBigNarrowU(shape, x, z, segW, segD, maxTier, sizeKey);
  } else if (shape.startsWith('uShape')) {
    results = buildBigUShape(shape, x, z, segW, segD, maxTier, sizeKey);
  } else {
    return [{ x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full' }];
  }

  const groupMarker = Symbol('group');
  for (const r of results) r._groupMarker = groupMarker;
  return results;
}
