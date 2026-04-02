/**
 * Emit battlement primitives along surviving wall segments.
 *
 * @param {object[]} primitives  Target array to push into
 * @param {object[]} segments    Wall segments from emitWallSegments
 * @param {number}   fixedPos    Fixed coordinate perpendicular to the wall
 * @param {boolean}  isXWall     True when the wall runs along X
 * @param {string}   side        'L' | 'R'
 * @param {number}   bridgeIdx   Bridge index (for naming)
 * @param {number}   battY       Y base of the battlements
 * @param {number}   battH       Battlement height (above wall)
 * @param {number}   wallT       Wall thickness
 * @param {number}   spacing     Battlement spacing
 * @param {number}   pillarW     Pillar width (spacing - gap)
 * @param {string}   texKey      Texture key
 */
export function emitBattlements(primitives, segments, fixedPos, isXWall, side, bridgeIdx, battY, battH, wallT, spacing, pillarW, texKey) {
  for (const seg of segments) {
    const segStart = seg.start;
    const segLen = seg.end - seg.start;
    for (let pos = 0; pos < segLen - pillarW; pos += spacing) {
      let bx, bz, bw, bd;
      if (isXWall) {
        bx = segStart + pos; bz = fixedPos - wallT / 2; bw = pillarW; bd = wallT;
      } else {
        bx = fixedPos - wallT / 2; bz = segStart + pos; bw = wallT; bd = pillarW;
      }

      primitives.push({
        type: 'slab', name: `bridge_batt_${bridgeIdx}_${side}_${Math.round(segStart + pos)}`,
        x: bx, y: battY, z: bz, w: bw, h: battH, d: bd,
        textureKey: texKey,
        emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
        shared: false,
        thinAxis: isXWall ? 'z' : 'x',
      });
    }
  }
}
