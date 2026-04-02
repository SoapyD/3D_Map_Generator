import { GRID } from '../config.js';

const MIN_BLOCK_SIZE = GRID.minBlockSize;

export function bspSplit(region, rng, streetWidth, leaves) {
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
