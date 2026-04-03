import { findBranchGaps } from '../building-lookup/index.js';
import { splitWallSegments } from '../walls/index.js';

/**
 * Emit wall-segment primitives for one side of a bridge,
 * splitting around branch gaps.
 *
 * @param {object[]} primitives  Target array to push into
 * @param {object}   bridge      Bridge descriptor (b)
 * @param {number}   bridgeIdx   Index of the bridge
 * @param {string}   side        'L' | 'R'
 * @param {string}   wallAxis    'x' | 'z'
 * @param {number}   wallStart   Start coordinate along the wall axis
 * @param {number}   wallEnd     End coordinate along the wall axis
 * @param {number}   fixedPos    Fixed coordinate perpendicular to the wall
 * @param {boolean}  isXWall     True when the wall runs along X
 * @param {number}   wallY       Y base of the wall
 * @param {number}   wallH       Wall height
 * @param {number}   wallT       Wall thickness
 * @param {string}   texKey      Texture key
 * @param {object[]} allBranches All branch items for gap detection
 * @returns {object[]} The surviving wall segments (for battlement placement)
 */
export function emitWallSegments(primitives, bridge, bridgeIdx, side, wallAxis, wallStart, wallEnd, fixedPos, isXWall, wallY, wallH, wallT, texKey, allBranches) {
  const gaps = findBranchGaps(bridge, wallAxis, wallStart, wallEnd, fixedPos, allBranches);
  const segments = splitWallSegments(wallStart, wallEnd, gaps);

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const segLen = seg.end - seg.start;
    let sx, sz, sw, sd;
    if (isXWall) {
      sx = seg.start; sz = fixedPos - wallT / 2; sw = segLen; sd = wallT;
    } else {
      sx = fixedPos - wallT / 2; sz = seg.start; sw = wallT; sd = segLen;
    }

    primitives.push({
      type: 'slab', name: `bridge_wall_${bridgeIdx}_${side}_seg${si}`,
      x: sx, y: wallY, z: sz, w: sw, h: wallH, d: sd,
      textureKey: texKey,
      emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: false,
      thinAxis: isXWall ? 'z' : 'x',
    });
  }

  return segments;
}
