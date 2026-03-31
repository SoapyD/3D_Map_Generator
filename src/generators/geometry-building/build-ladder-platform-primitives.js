/**
 * Build ladder platform primitives from pipeline data.
 */

import { GEOMETRY } from '../../config.js';

/**
 * Build ladder platform primitives from pipeline data.
 *
 * @param {object[]} ladderPlatforms - Ladder platform data array
 * @returns {object[]} Array of primitives
 */
export function buildLadderPlatformPrimitives(ladderPlatforms) {
  const primitives = [];

  for (let i = 0; i < ladderPlatforms.length; i++) {
    const p = ladderPlatforms[i];
    primitives.push({
      type: 'slab', name: `ladder_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex}`,
      emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `ladder_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex}`,
    });
  }

  return primitives;
}
