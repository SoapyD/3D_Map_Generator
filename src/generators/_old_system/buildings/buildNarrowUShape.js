import { BUILDING } from '../../config.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Build a narrow U-shape: 2x3 grid, full column + top stub + bottom stub, indent on one side.
 * Returns an array of building objects to push.
 */
export function buildNarrowUShape(shape, x, z, maxTier, heightKey, rng, startIndex) {
  const groupId = startIndex;
  const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
  const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
  const bProps = { maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId };

  let col, top, bot, colSup, topSup, botSup;
  if (shape === 'uNarrowN') {
    // ##    full left column + top-right + bottom-right, gap at middle-right
    // #.
    // ##
    col = { x, z, w: segW, d: segD * 3 };
    top = { x: x + segW, z, w: segW, d: segD };
    bot = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    colSup = [{ edge: 'east', zMin: top.z, zMax: top.z + top.d }, { edge: 'east', zMin: bot.z, zMax: bot.z + bot.d }];
    topSup = [{ edge: 'west' }];
    botSup = [{ edge: 'west' }];
  } else if (shape === 'uNarrowS') {
    // ##    full right column + top-left + bottom-left, gap at middle-left
    // .#
    // ##
    col = { x: x + segW, z, w: segW, d: segD * 3 };
    top = { x, z, w: segW, d: segD };
    bot = { x, z: z + segD * 2, w: segW, d: segD };
    colSup = [{ edge: 'west', zMin: top.z, zMax: top.z + top.d }, { edge: 'west', zMin: bot.z, zMax: bot.z + bot.d }];
    topSup = [{ edge: 'east' }];
    botSup = [{ edge: 'east' }];
  } else if (shape === 'uNarrowE') {
    // ###   full top row + left-bottom + right-bottom, gap at middle-bottom (rotated)
    // #.#
    col = { x, z, w: segW * 3, d: segD };
    top = { x, z: z + segD, w: segW, d: segD };
    bot = { x: x + segW * 2, z: z + segD, w: segW, d: segD };
    colSup = [{ edge: 'south', xMin: top.x, xMax: top.x + top.w }, { edge: 'south', xMin: bot.x, xMax: bot.x + bot.w }];
    topSup = [{ edge: 'north' }];
    botSup = [{ edge: 'north' }];
  } else { // uNarrowW
    // #.#   full bottom row + left-top + right-top, gap at middle-top (rotated)
    // ###
    col = { x, z: z + segD, w: segW * 3, d: segD };
    top = { x, z, w: segW, d: segD };
    bot = { x: x + segW * 2, z, w: segW, d: segD };
    colSup = [{ edge: 'north', xMin: top.x, xMax: top.x + top.w }, { edge: 'north', xMin: bot.x, xMax: bot.x + bot.w }];
    topSup = [{ edge: 'south' }];
    botSup = [{ edge: 'south' }];
  }

  return [
    { x: col.x, z: col.z, w: col.w, d: col.d, ...bProps, suppressEdges: colSup },
    { x: top.x, z: top.z, w: top.w, d: top.d, ...bProps, suppressEdges: topSup },
    { x: bot.x, z: bot.z, w: bot.w, d: bot.d, ...bProps, suppressEdges: botSup },
  ];
}
