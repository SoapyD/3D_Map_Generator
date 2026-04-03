/**
 * Build a single ladder primitive from ladder data.
 */

import { GEOMETRY } from '../../config.js';

/**
 * Build a single ladder primitive from ladder data.
 *
 * @param {string} name - Primitive name
 * @param {object} l - Ladder data (x, z, w, d, y0, y1)
 * @param {number} texIdx - Texture index
 * @param {object[]} walls - Wall data from pipeline (needed for wall offset detection)
 * @returns {object|null} Ladder primitive or null if height <= 0
 */
export function buildLadderPrimitive(name, l, texIdx, walls) {
  const height = l.y1 - l.y0;
  if (height <= 0) return null;

  const isThinX = l.w < l.d;
  const ladderWidth = isThinX ? l.d : l.w;
  const cx = l.x + l.w / 2;
  const cz = l.z + l.d / 2;
  const halfSpread = (ladderWidth / 2) - GEOMETRY.ladderPoleWidth / 2 - GEOMETRY.ladderRungInset;

  // Calculate pole positions
  const poles = [];
  const rungs = [];

  if (isThinX) {
    poles.push({ x: cx, z: cz - halfSpread - GEOMETRY.ladderPoleWidth / 2, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
    poles.push({ x: cx, z: cz + halfSpread - GEOMETRY.ladderPoleWidth / 2, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
  } else {
    poles.push({ x: cx - halfSpread - GEOMETRY.ladderPoleWidth / 2, z: cz, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
    poles.push({ x: cx + halfSpread - GEOMETRY.ladderPoleWidth / 2, z: cz, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
  }

  const rungCount = Math.floor(height / GEOMETRY.ladderRungSpacing);
  for (let r = 1; r <= rungCount; r++) {
    const ry = l.y0 + r * GEOMETRY.ladderRungSpacing;
    if (ry >= l.y1 - GEOMETRY.ladderRungSpacing * 0.3) break;
    const rungLen = halfSpread * 2 + GEOMETRY.ladderPoleWidth;

    if (isThinX) {
      rungs.push({ x: cx, y: ry, z: cz - halfSpread - GEOMETRY.ladderPoleWidth / 2, w: GEOMETRY.ladderRungDepth, h: GEOMETRY.ladderRungHeight, d: rungLen });
    } else {
      rungs.push({ x: cx - halfSpread - GEOMETRY.ladderPoleWidth / 2, y: ry, z: cz, w: rungLen, h: GEOMETRY.ladderRungHeight, d: GEOMETRY.ladderRungDepth });
    }
  }

  // Detect wall offset direction (for OBJ flat mode)
  let wallOffsetDir = 1;
  let nearestWallDist = Infinity;
  for (const wall of walls) {
    const wx1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
    const wz1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
    if (isThinX) {
      if (cz >= wall.z - 0.5 && cz <= wz1 + 0.5) {
        const wallCx = (wall.x + wx1) / 2;
        const dist = Math.abs(wallCx - cx);
        if (dist < nearestWallDist) {
          nearestWallDist = dist;
          wallOffsetDir = (cx >= wallCx) ? 1 : -1;
        }
      }
    } else {
      if (cx >= wall.x - 0.5 && cx <= wx1 + 0.5) {
        const wallCz = (wall.z + wz1) / 2;
        const dist = Math.abs(wallCz - cz);
        if (dist < nearestWallDist) {
          nearestWallDist = dist;
          wallOffsetDir = (cz >= wallCz) ? 1 : -1;
        }
      }
    }
  }

  return {
    type: 'ladder', name,
    x: l.x, y0: l.y0, y1: l.y1, z: l.z, w: l.w, d: l.d,
    poles, rungs,
    isThinX, wallOffsetDir,
    textureKey: `ladder:${texIdx}`,
  };
}
