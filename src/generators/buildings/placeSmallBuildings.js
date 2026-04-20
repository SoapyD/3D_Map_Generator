import { BUILDING } from '../../config.js';
import { rectsOverlap, getBounds, placementValid } from '../utils/rects/index.js';
// import { pickShape } from './pickShape.js';                    // old system — weighted shape picker
// import { buildDiagonalShape } from './buildDiagonalShape.js';  // old system — diagonal two-rect shape
// import { buildLShape } from './buildLShape.js';                // old system — L-shaped multi-quadrant
// import { buildUShape } from './buildUShape.js';                // old system — U-shaped multi-quadrant
// import { buildNarrowUShape } from './buildNarrowUShape.js';    // old system — narrow U multi-quadrant
// import { buildSmallUShape } from './buildSmallUShape.js';      // old system — small U multi-quadrant

const FOOTPRINTS = BUILDING.footprints;
const HEIGHTS = BUILDING.heights;


export function placeSmallBuildings(blocks, streetBounds, config, rng, tiers) {
  const buildings = [];
  let towerCount = 0;
  const maxTowers = BUILDING.maxTowers || Infinity;

  const avgSize = (FOOTPRINTS.small.min + FOOTPRINTS.small.max) / 2;
  const minCellSize = avgSize * BUILDING.cellSizeMultiplier;

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const cols = Math.max(1, Math.floor(block.w / minCellSize));
    const rows = Math.max(1, Math.floor(block.d / minCellSize));
    const cellW = block.w / cols;
    const cellD = block.d / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = block.x + col * cellW;
        const cellZ = block.z + row * cellD;

        if (towerCount < maxTowers && BUILDING.towerChance && rng.chance(BUILDING.towerChance)) {
          const tFp = FOOTPRINTS.tower || { min: 2, max: 3 };
          const w = Math.min(rng.float(tFp.min, tFp.max), cellW);
          const d = Math.min(rng.float(tFp.min, tFp.max), cellD);
          const x = cellX + (cellW - w) / 2;
          const z = cellZ + (cellD - d) / 2;
          const pyramidRoof = rng.chance(BUILDING.pyramidRoofChance);
          const towerCandidate = [{ x, z, w, d, maxTier: tiers, size: 'tower', height: 'tall', blockIndex: bi, pyramidRoof }];
          if (placementValid(towerCandidate, blocks, streetBounds)) {
            buildings.push(...towerCandidate);
            towerCount++;
          }
        } else {
          const w = Math.min(rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max), cellW);
          const d = Math.min(rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max), cellD);
          const x = cellX + (cellW - w) / 2;
          const z = cellZ + (cellD - d) / 2;

          const heightKey = rng.pick(['short', 'medium', 'tall']);
          const height = HEIGHTS[heightKey];
          const maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));

          // const shape = pickShape(rng);
          // let candidates;
          // if (shape === 'diagA' || shape === 'diagB') {
          //   candidates = buildDiagonalShape(shape, x, z, w, d, maxTier, heightKey, tiers, rng, buildings.length);
          // } else if (shape.startsWith('lShape')) {
          //   candidates = buildLShape(shape, x, z, maxTier, heightKey, rng, buildings.length);
          // } else if (shape.startsWith('uShape')) {
          //   candidates = buildUShape(shape, x, z, maxTier, heightKey, rng, buildings.length);
          // } else if (shape.startsWith('uNarrow')) {
          //   candidates = buildNarrowUShape(shape, x, z, maxTier, heightKey, rng, buildings.length);
          // } else if (shape.startsWith('uSmall')) {
          //   candidates = buildSmallUShape(shape, x, z, maxTier, heightKey, rng, buildings.length);
          // } else {
          //   candidates = [{ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: bi, shape }];
          // }

          const candidates = [{ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: bi, shape: 'full' }];

          if (placementValid(candidates, blocks, streetBounds)) {
            candidates.forEach(seg => { seg.blockIndex = bi; });
            buildings.push(...candidates);
          } else {
            const fallback = [{ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: bi, shape: 'full' }];
            if (placementValid(fallback, blocks, streetBounds)) {
              buildings.push(...fallback);
            }
          }
        }
      }
    }
  }

  return buildings;
}

