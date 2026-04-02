/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

import { BUILDING, DELETIONS } from '../../config.js';
import { getLayoutSpecs } from './getLayoutSpecs.js';
import { generateBigBuilding } from './generateBigBuilding.js';
import { pickShape } from './pickShape.js';
import { buildDiagonalShape } from './buildDiagonalShape.js';
import { buildLShape } from './buildLShape.js';
import { buildUShape } from './buildUShape.js';
import { buildNarrowUShape } from './buildNarrowUShape.js';
import { buildSmallUShape } from './buildSmallUShape.js';
import { overlapsAny } from './overlapsAny.js';

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

  // Place larger buildings one at a time, validating each against existing buildings.
  // Small buildings earmarked for displacement are restored if the big building can't be placed.
  const layout = rng.int(0, 4);
  const specs = getLayoutSpecs(layout, config);

  const placedBig = [];       // successfully placed big building segments
  const displacedByBig = [];  // small buildings confirmed displaced

  for (const spec of specs) {
    const MAX_ATTEMPTS = 4; // 1 initial + 3 retries

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generateBigBuilding(spec.sizeKey, spec.pos, config, tiers, rng);

      // Earmark small buildings that would be displaced by this candidate
      const earmarked = [];
      const notEarmarked = [];
      if (DELETIONS.buildingDisplaceByLarge) {
        for (const b of buildings) {
          // Skip buildings already displaced by a previous big building
          if (displacedByBig.includes(b)) continue;
          let touches = false;
          for (const seg of candidate) {
            if (b.x < seg.x + seg.w + BUILDING_GAP && b.x + b.w > seg.x - BUILDING_GAP &&
                b.z < seg.z + seg.d + BUILDING_GAP && b.z + b.d > seg.z - BUILDING_GAP) {
              touches = true;
              break;
            }
          }
          if (touches) earmarked.push(b);
          else notEarmarked.push(b);
        }
      }

      // Check candidate against: already-placed big buildings + non-earmarked small buildings
      const checkAgainst = [...placedBig, ...notEarmarked];
      if (!overlapsAny(candidate, checkAgainst)) {
        // Success — confirm this placement
        placedBig.push(...candidate);
        displacedByBig.push(...earmarked);
        break;
      }
      // Overlap detected — retry with a different shape/size
    }
    // If all attempts failed, earmarked buildings are NOT displaced (restored implicitly)
  }

  // Resolve texture groups for placed big buildings
  const groups = new Map();
  for (let i = 0; i < placedBig.length; i++) {
    const b = placedBig[i];
    if (b._groupMarker) {
      if (!groups.has(b._groupMarker)) groups.set(b._groupMarker, i);
      b.textureGroup = groups.get(b._groupMarker);
      delete b._groupMarker;
    }
  }

  // Surviving small buildings = all except those displaced by big buildings
  const surviving = buildings.filter(b => !displacedByBig.includes(b));

  // Remove overlapping small buildings (complex shapes can overflow cell boundaries)
  const noOverlap = [];
  for (let i = 0; i < surviving.length; i++) {
    const a = surviving[i];
    let dominated = false;
    for (let j = 0; j < surviving.length; j++) {
      if (i === j) continue;
      if (a.textureGroup !== undefined && a.textureGroup === surviving[j].textureGroup) continue;
      const b = surviving[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.z < b.z + b.d && a.z + a.d > b.z) {
        if (i > j) { dominated = true; break; }
      }
    }
    if (!dominated) noOverlap.push(a);
  }
  const displacedByOverlap = surviving.filter(b => !noOverlap.includes(b));

  // Delete 15% of remaining small buildings — track deleted positions for cover placement
  let culled, randomlyDeleted;
  if (DELETIONS.buildingRandomCull) {
    const deleteRatio = BUILDING.deleteRatio;
    rng.shuffle(noOverlap);
    const keepCount = Math.ceil(noOverlap.length * (1 - deleteRatio));
    culled = noOverlap.slice(0, keepCount);
    randomlyDeleted = noOverlap.slice(keepCount);
  } else {
    culled = noOverlap;
    randomlyDeleted = [];
  }

  // All deleted buildings = displaced by big + overlap + randomly culled
  const deletedBuildings = [...displacedByBig, ...displacedByOverlap, ...randomlyDeleted];

  return { ...gridData, buildings: [...placedBig, ...culled], deletedBuildings };
}
