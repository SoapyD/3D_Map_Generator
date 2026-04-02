/**
 * Build geometry primitives for bridges (slab, walls, battlements).
 */

import { CONNECTIVITY } from '../../config.js';
import { emitWallSegments } from './emit-wall-segments.js';
import { emitBattlements } from './emit-battlements.js';

/**
 * @param {object[]} bridges     Bridge descriptors
 * @param {object[]} walkways    Walkway descriptors (for branch gap detection)
 * @param {object[]} allBranches Combined branch items
 * @returns {object[]}           Primitives for all bridges
 */
export function buildBridgePrimitives(bridges, walkways, allBranches) {
  const primitives = [];
  const bridgeThickness = CONNECTIVITY.bridgeThickness || 0.5;
  const wallH = CONNECTIVITY.bridgeWallHeight || 0.75;
  const wallT = CONNECTIVITY.bridgeWallThickness || 0.25;

  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];

    // Bridge texture — branches use parent's texture via textureId
    const bridgeTexIdx = (b.textureId !== undefined)
      ? bridges.findIndex(br => br.textureId === b.textureId && !br.branch)
      : i;
    const texKey = `wall:landmark:${bridgeTexIdx >= 0 ? bridgeTexIdx : i}`;

    // Bridge slab
    primitives.push({
      type: 'slab', name: `bridge_${i}`,
      x: b.x, y: b.y, z: b.z, w: b.w, h: bridgeThickness, d: b.d,
      textureKey: texKey,
      emitTop: true, emitBottom: true, simpleBottom: false,
      rotateUV: b.w > b.d,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `bridge_${i}`,
      x: b.x, y: b.y, z: b.z, w: b.w, h: bridgeThickness, d: b.d,
      textureKey: texKey,
    });

    // Side walls with gap detection
    const wallY = b.y + bridgeThickness;

    let segmentsL, segmentsR;
    if (b.axis === 'x') {
      segmentsL = emitWallSegments(primitives, b, i, 'L', 'x', b.x, b.x + b.w, b.z + wallT / 2, true, wallY, wallH, wallT, texKey, allBranches);
      segmentsR = emitWallSegments(primitives, b, i, 'R', 'x', b.x, b.x + b.w, b.z + b.d - wallT / 2, true, wallY, wallH, wallT, texKey, allBranches);
    } else {
      segmentsL = emitWallSegments(primitives, b, i, 'L', 'z', b.z, b.z + b.d, b.x + wallT / 2, false, wallY, wallH, wallT, texKey, allBranches);
      segmentsR = emitWallSegments(primitives, b, i, 'R', 'z', b.z, b.z + b.d, b.x + b.w - wallT / 2, false, wallY, wallH, wallT, texKey, allBranches);
    }

    // Battlements — only within surviving wall segments
    if (b.variant === 'battlement') {
      const battH = CONNECTIVITY.bridgeBattlementHeight - wallH;
      const spacing = CONNECTIVITY.bridgeBattlementSpacing || 2.25;
      const gap = CONNECTIVITY.bridgeBattlementGap || 1.5;
      const pillarW = spacing - gap;
      const battY = wallY + wallH;

      if (b.axis === 'x') {
        emitBattlements(primitives, segmentsL, b.z + wallT / 2, true, 'L', i, battY, battH, wallT, spacing, pillarW, texKey);
        emitBattlements(primitives, segmentsR, b.z + b.d - wallT / 2, true, 'R', i, battY, battH, wallT, spacing, pillarW, texKey);
      } else {
        emitBattlements(primitives, segmentsL, b.x + wallT / 2, false, 'L', i, battY, battH, wallT, spacing, pillarW, texKey);
        emitBattlements(primitives, segmentsR, b.x + b.w - wallT / 2, false, 'R', i, battY, battH, wallT, spacing, pillarW, texKey);
      }
    }
  }

  return primitives;
}
