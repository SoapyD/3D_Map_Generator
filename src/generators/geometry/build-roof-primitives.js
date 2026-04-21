/**
 * Build roof primitives (flat and pyramid) from pipeline data.
 */

import { getTexGroup } from '../geometry-helpers/index.js';
import { floorTextureKey } from '../floor-texture-key.js';

/**
 * Build roof primitives (flat and pyramid) from pipeline data.
 *
 * @param {object[]} roofEntries - Roof data array
 * @param {object[]} buildings - Building data array
 * @param {object} config - Generation config
 * @returns {object[]} Array of primitives
 */
export function buildRoofPrimitives(roofEntries, buildings, config) {
  const primitives = [];

  for (let ri = 0; ri < roofEntries.length; ri++) {
    const roof = roofEntries[ri];
    const roofTexKey = `roof:${getTexGroup(roof.buildingIndex, buildings)}`;
    const ceilingTexKey = floorTextureKey(roof.buildingIndex, buildings);
    const ry = roof.yCollisionLevel;

    for (let si = 0; si < roof.rects.length; si++) {
      const rs = roof.rects[si];
      const name = `roof_${ri}_${si}`;

      primitives.push({
        type: 'slab', name,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
        emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
        shared: true,
      });
      primitives.push({
        type: 'ceiling', name: `roof_ceil_${ri}_${si}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: ceilingTexKey,
        shared: true,
      });
      primitives.push({
        type: 'edges', name,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
      });
    }
  }

  return primitives;
}
