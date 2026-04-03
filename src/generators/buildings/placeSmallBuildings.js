import { BUILDING } from '../../config.js';
import { pickShape } from './pickShape.js';
import { buildDiagonalShape } from './buildDiagonalShape.js';
import { buildLShape } from './buildLShape.js';
import { buildUShape } from './buildUShape.js';
import { buildNarrowUShape } from './buildNarrowUShape.js';
import { buildSmallUShape } from './buildSmallUShape.js';

const FOOTPRINTS = BUILDING.footprints;
const HEIGHTS = BUILDING.heights;

export function placeSmallBuildings(cols, rows, cellW, cellD, config, rng, tiers) {
  const buildings = [];
  let towerCount = 0;
  const maxTowers = BUILDING.maxTowers || Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * cellW;
      const cellZ = row * cellD;

      // Chance to place a tower instead of a small building
      if (towerCount < maxTowers && BUILDING.towerChance && rng.chance(BUILDING.towerChance)) {
        const tFp = FOOTPRINTS.tower || { min: 2, max: 3 };
        const w = rng.float(tFp.min, tFp.max);
        const d = rng.float(tFp.min, tFp.max);
        const x = cellX + (cellW - w) / 2;
        const z = cellZ + (cellD - d) / 2;
        const pyramidRoof = rng.chance(BUILDING.pyramidRoofChance);
        buildings.push({ x, z, w, d, maxTier: tiers, size: 'tower', height: 'tall', blockIndex: 0, pyramidRoof });
        towerCount++;
      } else {
        // Standard small building
        const w = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
        const d = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
        const x = cellX + (cellW - w) / 2;
        const z = cellZ + (cellD - d) / 2;

        const heightKey = rng.pick(['short', 'medium', 'tall']);
        const height = HEIGHTS[heightKey];
        const maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));

        // Pick a building shape
        const shape = pickShape(rng);

        if (shape === 'diagA' || shape === 'diagB') {
          buildings.push(...buildDiagonalShape(shape, x, z, w, d, maxTier, heightKey, tiers, rng, buildings.length));
        } else if (shape.startsWith('lShape')) {
          buildings.push(...buildLShape(shape, x, z, maxTier, heightKey, rng, buildings.length));
        } else if (shape.startsWith('uShape')) {
          buildings.push(...buildUShape(shape, x, z, maxTier, heightKey, rng, buildings.length));
        } else if (shape.startsWith('uNarrow')) {
          buildings.push(...buildNarrowUShape(shape, x, z, maxTier, heightKey, rng, buildings.length));
        } else if (shape.startsWith('uSmall')) {
          buildings.push(...buildSmallUShape(shape, x, z, maxTier, heightKey, rng, buildings.length));
        } else {
          buildings.push({ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape });
        }
      }
    }
  }

  return buildings;
}
