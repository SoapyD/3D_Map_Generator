import { BUILDING } from '../../config.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Build an L-shape: 3 segments long x 2 segments wide, 4 of 6 cells filled.
 * Returns an array of building objects to push.
 */
export function buildLShape(shape, x, z, maxTier, heightKey, rng, startIndex) {
  const groupId = startIndex;
  const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
  const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);

  // The strip is 1 segment wide x 3 segments deep
  // The extension is 1 segment wide x 1 segment deep, adjacent to one end
  let strip, ext, stripSuppress, extSuppress;
  if (shape === 'lShapeSW') {
    // #.
    // #.
    // ##
    strip = { x, z, w: segW, d: segD * 3 };
    ext   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    // Strip suppresses east wall in the zone where ext meets it
    stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'west' }];
  } else if (shape === 'lShapeSE') {
    // .#
    // .#
    // ##
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext   = { x, z: z + segD * 2, w: segW, d: segD };
    stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'east' }];
  } else if (shape === 'lShapeNW') {
    // ##
    // #.
    // #.
    strip = { x, z, w: segW, d: segD * 3 };
    ext   = { x: x + segW, z, w: segW, d: segD };
    stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'west' }];
  } else { // lShapeNE
    // ##
    // .#
    // .#
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext   = { x, z, w: segW, d: segD };
    stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'east' }];
  }

  return [
    { x: strip.x, z: strip.z, w: strip.w, d: strip.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: stripSuppress, textureGroup: groupId },
    { x: ext.x, z: ext.z, w: ext.w, d: ext.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: extSuppress, textureGroup: groupId },
  ];
}
