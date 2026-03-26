/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

// Footprint sizes (width/depth in inches)
const FOOTPRINTS = {
  small:  { min: 4, max: 7 },
  medium: { min: 7, max: 12 },
  large:  { min: 11, max: 18 },
};

// Height is independent of footprint — any footprint can be any height
const HEIGHTS = {
  short: { tierMin: 2, tierMax: 2 },
  medium: { tierMin: 2, tierMax: 3 },
  tall:  { tierMin: 3, tierMax: 4 },
};

const BUILDING_GAP = 0.5; // minimum gap between buildings (inches)
const TARGET_COVERAGE = 0.85; // target higher to compensate for small buildings

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
  const minCellSize = avgSize * 1.25;

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

  return { ...gridData, buildings };
}

/**
 * Fill a block with buildings on a grid.
 * Each cell gets a small building with a gap between them.
 */
function fillBlock(block, maxTiers, rng, allowLarge = true) {
  const results = [];
  const fp = FOOTPRINTS.small;

  // Pick a consistent building size for this block (with some variance)
  const cellW = rng.float(fp.min, fp.max);
  const cellD = rng.float(fp.min, fp.max);
  const stepW = cellW + BUILDING_GAP;
  const stepD = cellD + BUILDING_GAP;

  // How many fit in this block?
  const cols = Math.floor(block.w / stepW);
  const rows = Math.floor(block.d / stepD);
  if (cols < 1 || rows < 1) return results;

  // Centre the grid within the block
  const offsetX = block.x + (block.w - cols * stepW + BUILDING_GAP) / 2;
  const offsetZ = block.z + (block.d - rows * stepD + BUILDING_GAP) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * stepW;
      const z = offsetZ + row * stepD;

      // Slight size variance per building
      const w = cellW + rng.float(-0.5, 0.5);
      const d = cellD + rng.float(-0.5, 0.5);

      // Random height
      const heightKey = rng.pick(['short', 'medium', 'tall']);
      const height = HEIGHTS[heightKey];
      const maxTier = rng.int(Math.min(height.tierMin, maxTiers), Math.min(height.tierMax, maxTiers));

      results.push({ x, z, w, d, maxTier, size: 'small', height: heightKey });
    }
  }

  return results;
}

/**
 * Choose a mix of building sizes for a block.
 * Large buildings placed first so they get priority for space.
 */
function chooseMix(block, rng, allowLarge = true) {
  const area = block.w * block.d;
  const mix = [];

  // Number of buildings to attempt based on block area — high count for dense packing
  const count = area > 400 ? rng.int(12, 18) : area > 250 ? rng.int(8, 14) : area > 150 ? rng.int(6, 10) : rng.int(4, 6);

  // All small footprint for now
  for (let i = 0; i < count; i++) {
    mix.push('small');
  }

  return mix;
}

/**
 * Check if a candidate building collides with already-placed buildings.
 * Buildings must not overlap and must maintain minimum gap.
 */
function collides(candidate, existing) {
  for (const other of existing) {
    if (candidate.x < other.x + other.w + BUILDING_GAP &&
        candidate.x + candidate.w > other.x - BUILDING_GAP &&
        candidate.z < other.z + other.d + BUILDING_GAP &&
        candidate.z + candidate.d > other.z - BUILDING_GAP) {
      return true;
    }
  }
  return false;
}
