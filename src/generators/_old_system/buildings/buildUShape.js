import { BUILDING } from '../../config.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Build a U-shape: 3x2 grid, two columns + connecting bar.
 * Returns an array of building objects to push.
 */
export function buildUShape(shape, x, z, maxTier, heightKey, rng, startIndex) {
  const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
  const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);

  // Three parts: left column, right column, connecting bar
  // The open side has no bar
  let left, right, bar, leftSup, rightSup, barSup;
  if (shape === 'uShapeN') {
    // #.#    open top
    // #.#
    // ###
    left  = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup   = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeS') {
    // ###    open bottom
    // #.#
    // #.#
    left  = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar   = { x: x + segW, z, w: segW, d: segD };
    leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup   = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeE') {
    // ##.    open right (rotated: rows are horizontal)
    // ###
    // ##.
    left  = { x, z, w: segW * 3, d: segD };              // top row
    right = { x, z: z + segD * 2, w: segW * 3, d: segD }; // bottom row
    bar   = { x, z: z + segD, w: segW, d: segD };         // left connecting bar
    leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup   = [{ edge: 'north' }, { edge: 'south' }];
  } else { // uShapeW
    // .##    open left (rotated: rows are horizontal)
    // ###
    // .##
    left  = { x, z, w: segW * 3, d: segD };              // top row
    right = { x, z: z + segD * 2, w: segW * 3, d: segD }; // bottom row
    bar   = { x: x + segW * 2, z: z + segD, w: segW, d: segD }; // right connecting bar
    leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup   = [{ edge: 'north' }, { edge: 'south' }];
  }

  const groupId = startIndex;
  return [
    { x: left.x, z: left.z, w: left.w, d: left.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: leftSup, textureGroup: groupId },
    { x: right.x, z: right.z, w: right.w, d: right.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: rightSup, textureGroup: groupId },
    { x: bar.x, z: bar.z, w: bar.w, d: bar.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: barSup, textureGroup: groupId },
  ];
}
