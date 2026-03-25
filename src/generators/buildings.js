/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

// Size categories with dimension ranges (inches)
const SIZES = {
  small:  { min: 4, max: 7, tierMin: 1, tierMax: 2 },
  medium: { min: 7, max: 12, tierMin: 2, tierMax: 3 },
  large:  { min: 11, max: 18, tierMin: 3, tierMax: 4 },
};

const BUILDING_GAP = 0.75; // minimum gap between buildings (inches)
const TARGET_COVERAGE = 0.70; // target 70% of block area covered

/**
 * @param {{ blocks: Array<{x,z,w,d}> }} gridData
 * @param {object} config
 * @param {object} rng
 * @returns {{ buildings: Array, blocks: Array, streets: Array }}
 */
export function generateBuildings(gridData, config, rng) {
  const { tiers } = config;
  const buildings = [];

  for (let i = 0; i < gridData.blocks.length; i++) {
    const block = gridData.blocks[i];
    const placed = fillBlock(block, tiers, rng);
    for (const b of placed) {
      b.blockIndex = i;
      buildings.push(b);
    }
  }

  return { ...gridData, buildings };
}

/**
 * Fill a block with buildings targeting 70% coverage.
 * Places large buildings first, then fills gaps with medium and small.
 */
function fillBlock(block, maxTiers, rng) {
  const results = [];
  const blockArea = block.w * block.d;
  const targetArea = blockArea * TARGET_COVERAGE;

  // Decide the mix — large first so they get placed before space runs out
  const mix = chooseMix(block, rng);

  let coveredArea = 0;

  for (const sizeKey of mix) {
    if (coveredArea >= targetArea) break;

    const size = SIZES[sizeKey];
    const cappedTierMin = Math.min(size.tierMin, maxTiers);
    const cappedTierMax = Math.min(size.tierMax, maxTiers);

    // Generate dimensions
    let w = rng.float(size.min, size.max);
    let d = rng.float(size.min, size.max);

    // Occasionally make non-square aspect ratios
    if (rng.chance(0.4)) {
      const stretch = rng.float(1.2, 1.6);
      if (rng.chance(0.5)) w *= stretch; else d *= stretch;
    }

    // Clamp to block bounds
    w = Math.min(w, block.w);
    d = Math.min(d, block.d);
    if (w < SIZES.small.min || d < SIZES.small.min) continue;

    // Try to place — many attempts for dense packing
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      // Compute valid placement range — building must be fully inside block
      const maxX = block.x + block.w - w;
      const maxZ = block.z + block.d - d;
      if (maxX < block.x || maxZ < block.z) break; // doesn't fit

      const x = rng.float(block.x, maxX);
      const z = rng.float(block.z, maxZ);
      const candidate = { x, z, w, d };

      if (!collides(candidate, results)) {
        const maxTier = rng.int(cappedTierMin, cappedTierMax);
        results.push({ x, z, w, d, maxTier, size: sizeKey });
        coveredArea += w * d;
        placed = true;
        break;
      }
    }

    // If we couldn't place it, try shrinking
    if (!placed) {
      const shrunkW = Math.min(w * 0.6, block.w);
      const shrunkD = Math.min(d * 0.6, block.d);
      if (shrunkW >= SIZES.small.min && shrunkD >= SIZES.small.min) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const maxX = block.x + block.w - shrunkW;
          const maxZ = block.z + block.d - shrunkD;
          if (maxX < block.x || maxZ < block.z) break;

          const x = rng.float(block.x, maxX);
          const z = rng.float(block.z, maxZ);
          const candidate = { x, z, w: shrunkW, d: shrunkD };

          if (!collides(candidate, results)) {
            results.push({
              x, z, w: shrunkW, d: shrunkD,
              maxTier: rng.int(cappedTierMin, Math.min(cappedTierMax, SIZES.small.tierMax)),
              size: 'small',
            });
            coveredArea += shrunkW * shrunkD;
            break;
          }
        }
      }
    }
  }

  // If still under target, try filling remaining gaps with small buildings
  let fillAttempts = 0;
  while (coveredArea < targetArea && fillAttempts < 30) {
    fillAttempts++;
    const w = rng.float(SIZES.small.min, SIZES.small.max);
    const d = rng.float(SIZES.small.min, SIZES.small.max);

    const maxX = block.x + block.w - w;
    const maxZ = block.z + block.d - d;
    if (maxX < block.x || maxZ < block.z) continue;

    const x = rng.float(block.x, maxX);
    const z = rng.float(block.z, maxZ);
    const candidate = { x, z, w, d };

    if (!collides(candidate, results)) {
      results.push({
        x, z, w, d,
        maxTier: rng.int(SIZES.small.tierMin, Math.min(SIZES.small.tierMax, maxTiers)),
        size: 'small',
      });
      coveredArea += w * d;
    }
  }

  return results;
}

/**
 * Choose a mix of building sizes for a block.
 * Large buildings placed first so they get priority for space.
 */
function chooseMix(block, rng) {
  const area = block.w * block.d;
  const mix = [];

  if (area > 400) {
    mix.push(...Array(rng.int(1, 2)).fill('large'));
    mix.push(...Array(rng.int(2, 3)).fill('medium'));
    mix.push(...Array(rng.int(2, 4)).fill('small'));
  } else if (area > 250) {
    mix.push('large');
    mix.push(...Array(rng.int(1, 2)).fill('medium'));
    mix.push(...Array(rng.int(2, 3)).fill('small'));
  } else if (area > 150) {
    if (rng.chance(0.6)) mix.push('large');
    mix.push(...Array(rng.int(1, 2)).fill('medium'));
    mix.push(...Array(rng.int(1, 3)).fill('small'));
  } else if (area > 80) {
    mix.push('medium');
    mix.push(...Array(rng.int(1, 3)).fill('small'));
  } else {
    mix.push(...Array(rng.int(1, 2)).fill('small'));
  }

  // Place large first, then medium, then small — priority ordering
  const order = { large: 0, medium: 1, small: 2 };
  mix.sort((a, b) => order[a] - order[b]);
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
