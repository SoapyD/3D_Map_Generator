/**
 * Build junction platform primitives from pipeline data.
 */

import { GEOMETRY } from '../../config.js';

/**
 * Build junction platform primitives from pipeline data.
 *
 * @param {object[]} junctionPlatforms - Junction platform data array
 * @returns {object[]} Array of primitives
 */
export function buildJunctionPlatformPrimitives(junctionPlatforms) {
  const primitives = [];

  for (let i = 0; i < junctionPlatforms.length; i++) {
    const p = junctionPlatforms[i];
    primitives.push({
      type: 'slab', name: `junction_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex || 0}`,
      emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `junction_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex || 0}`,
    });
  }

  return primitives;
}
