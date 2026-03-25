/**
 * Stage 1: BSP Grid Partitioning
 *
 * Divides the map into city blocks separated by streets.
 * Uses Binary Space Partitioning for irregular block sizes.
 *
 * Output: Array of block rectangles { x, z, w, d } and street areas.
 */

const MIN_BLOCK_SIZE = 10; // minimum block dimension in inches

/**
 * @param {object} config
 * @param {import('../core/rng.js').createRng} rng
 * @returns {{ blocks: Array<{x,z,w,d}>, streets: Array<{x,z,w,d}> }}
 */
export function generateGrid(config, rng) {
  const { mapWidth, mapDepth, streetWidth } = config;

  // Start with the full map as one region
  const root = { x: 0, z: 0, w: mapWidth, d: mapDepth };

  // BSP split recursively
  const leaves = [];
  bspSplit(root, rng, streetWidth, leaves);

  // Extract streets from the gaps between blocks
  const streets = extractStreets(leaves, mapWidth, mapDepth, streetWidth);

  return { blocks: leaves, streets };
}

function bspSplit(region, rng, streetWidth, leaves) {
  const canSplitX = region.w > MIN_BLOCK_SIZE * 2 + streetWidth;
  const canSplitZ = region.d > MIN_BLOCK_SIZE * 2 + streetWidth;

  if (!canSplitX && !canSplitZ) {
    leaves.push(region);
    return;
  }

  // Choose split axis — prefer the longer dimension
  let splitX;
  if (canSplitX && canSplitZ) {
    splitX = region.w >= region.d ? rng.chance(0.7) : rng.chance(0.3);
  } else {
    splitX = canSplitX;
  }

  if (splitX) {
    // Split along X axis
    const minSplit = region.x + MIN_BLOCK_SIZE;
    const maxSplit = region.x + region.w - MIN_BLOCK_SIZE - streetWidth;
    const splitPos = rng.float(minSplit, maxSplit);

    const left = { x: region.x, z: region.z, w: splitPos - region.x, d: region.d };
    const right = {
      x: splitPos + streetWidth,
      z: region.z,
      w: region.x + region.w - (splitPos + streetWidth),
      d: region.d,
    };

    bspSplit(left, rng, streetWidth, leaves);
    bspSplit(right, rng, streetWidth, leaves);
  } else {
    // Split along Z axis
    const minSplit = region.z + MIN_BLOCK_SIZE;
    const maxSplit = region.z + region.d - MIN_BLOCK_SIZE - streetWidth;
    const splitPos = rng.float(minSplit, maxSplit);

    const top = { x: region.x, z: region.z, w: region.w, d: splitPos - region.z };
    const bottom = {
      x: region.x,
      z: splitPos + streetWidth,
      w: region.w,
      d: region.z + region.d - (splitPos + streetWidth),
    };

    bspSplit(top, rng, streetWidth, leaves);
    bspSplit(bottom, rng, streetWidth, leaves);
  }
}

function extractStreets(blocks, mapWidth, mapDepth, streetWidth) {
  // Streets are the negative space between blocks.
  // For simplicity, compute as the full map minus block coverage,
  // sampled on a coarse grid.
  const streets = [];
  const step = streetWidth;

  for (let x = 0; x < mapWidth; x += step) {
    for (let z = 0; z < mapDepth; z += step) {
      const inBlock = blocks.some(
        (b) => x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d,
      );
      if (!inBlock) {
        streets.push({ x, z, w: step, d: step });
      }
    }
  }

  return streets;
}
