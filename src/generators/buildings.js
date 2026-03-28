/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

import { BUILDING, DELETIONS } from '../config.js';

const FOOTPRINTS = BUILDING.footprints;
const HEIGHTS = BUILDING.heights;
const BUILDING_GAP = BUILDING.gap;

/**
 * @param {{ blocks: Array<{x,z,w,d}> }} gridData
 * @param {object} config
 * @param {object} rng
 * @returns {{ buildings: Array, blocks: Array, streets: Array }}
 */
export function generateBuildings(gridData, config, rng) {
  const { tiers } = config;
  const buildings = [];

  // Use the average small footprint size to determine grid count
  const avgSize = (FOOTPRINTS.small.min + FOOTPRINTS.small.max) / 2;
  const minCellSize = avgSize * BUILDING.cellSizeMultiplier;

  // Figure out how many fit, then stretch the cell size to fill the map
  const cols = Math.floor(config.mapWidth / minCellSize);
  const rows = Math.floor(config.mapDepth / minCellSize);
  const cellW = config.mapWidth / cols;
  const cellD = config.mapDepth / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * cellW;
      const cellZ = row * cellD;

      // Building fills most of the cell, centred
      const w = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
      const d = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
      const x = cellX + (cellW - w) / 2;
      const z = cellZ + (cellD - d) / 2;

      // Random height
      const heightKey = rng.pick(['short', 'medium', 'tall']);
      const height = HEIGHTS[heightKey];
      const maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));

      buildings.push({ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: 0 });
    }
  }

  // Pick a layout for larger buildings
  const layout = rng.int(0, 4);
  const bigBuildings = placeBigLayout(layout, config, tiers, rng);

  // Remove small buildings that touch any big building — track them
  const surviving = [];
  const displacedByBig = [];
  if (DELETIONS.buildingDisplaceByLarge) {
    for (const b of buildings) {
      let displaced = false;
      for (const big of bigBuildings) {
        if (b.x < big.x + big.w + BUILDING_GAP && b.x + b.w > big.x - BUILDING_GAP &&
            b.z < big.z + big.d + BUILDING_GAP && b.z + b.d > big.z - BUILDING_GAP) {
          displaced = true;
          break;
        }
      }
      if (displaced) displacedByBig.push(b);
      else surviving.push(b);
    }
  } else {
    surviving.push(...buildings);
  }

  // Delete 15% of remaining small buildings — track deleted positions for cover placement
  let culled, randomlyDeleted;
  if (DELETIONS.buildingRandomCull) {
    const deleteRatio = BUILDING.deleteRatio;
    rng.shuffle(surviving);
    const keepCount = Math.ceil(surviving.length * (1 - deleteRatio));
    culled = surviving.slice(0, keepCount);
    randomlyDeleted = surviving.slice(keepCount);
  } else {
    culled = surviving;
    randomlyDeleted = [];
  }

  // All deleted buildings = displaced by big + randomly culled
  const deletedBuildings = [...displacedByBig, ...randomlyDeleted];

  return { ...gridData, buildings: [...bigBuildings, ...culled], deletedBuildings };
}

/**
 * Place larger buildings according to one of 5 layout options.
 *
 * 0: 1 large in centre
 * 1: 2 large — top-left + bottom-right
 * 2: 3 medium — top-left + bottom-right + top-right
 * 3: 3 medium — top-left + bottom-left + top-right
 * 4: 4 medium — 2 in top-left + bottom-right + top-right
 */
function placeBigLayout(layout, config, maxTiers, rng) {
  const mw = config.mapWidth;
  const md = config.mapDepth;
  const margin = 2; // keep away from map edge

  // Quadrant centres
  const TL = { x: mw * 0.25, z: md * 0.25 };
  const TR = { x: mw * 0.75, z: md * 0.25 };
  const BL = { x: mw * 0.25, z: md * 0.75 };
  const BR = { x: mw * 0.75, z: md * 0.75 };
  const C  = { x: mw * 0.5, z: md * 0.5 };

  function makeBig(sizeKey, pos) {
    const fp = FOOTPRINTS[sizeKey];
    const w = rng.float(fp.min, fp.max);
    const d = rng.float(fp.min, fp.max);
    const x = Math.max(margin, Math.min(pos.x - w / 2, mw - w - margin));
    const z = Math.max(margin, Math.min(pos.z - d / 2, md - d - margin));
    const maxTier = rng.int(3, Math.min(5, maxTiers));
    return { x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0 };
  }

  switch (layout) {
    case 0: return [makeBig('large', C)];
    case 1: return [makeBig('large', TL), makeBig('large', BR)];
    case 2: return [makeBig('medium', TL), makeBig('medium', BR), makeBig('medium', TR)];
    case 3: return [makeBig('medium', TL), makeBig('medium', BL), makeBig('medium', TR)];
    case 4: {
      // 2 in top-left quadrant (offset slightly), 1 BR, 1 TR
      const TL1 = { x: mw * 0.15, z: md * 0.15 };
      const TL2 = { x: mw * 0.35, z: md * 0.35 };
      return [makeBig('medium', TL1), makeBig('medium', TL2), makeBig('medium', BR), makeBig('medium', TR)];
    }
  }
  return [];
}
