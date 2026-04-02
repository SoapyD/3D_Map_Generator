/**
 * Build roof primitives (flat and pyramid) from pipeline data.
 */

import { getTexGroup } from '../get-tex-group.js';
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

    if (roof.type === 'flat') {
      const ry = roof.tier * config.tierHeight;
      const rs = roof.section;

      // Top face — roof texture
      primitives.push({
        type: 'slab', name: `roof_flat_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
        emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
        shared: true,
      });
      // Bottom face — ceiling texture
      primitives.push({
        type: 'ceiling', name: `roof_ceil_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: ceilingTexKey,
        shared: true,
      });
      // Edges
      primitives.push({
        type: 'edges', name: `roof_flat_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
      });
    } else if (roof.type === 'pyramid') {
      const b = roof.building;
      const topY = roof.tier * config.tierHeight;
      const apexY = topY + Math.min(b.w, b.d) * 0.6;
      const cx = b.x + b.w / 2;
      const cz = b.z + b.d / 2;

      // 4 sloped triangle faces
      const faces = [
        { name: 'N', verts: [[b.x + b.w, topY, b.z], [b.x, topY, b.z], [cx, apexY, cz]] },
        { name: 'E', verts: [[b.x + b.w, topY, b.z + b.d], [b.x + b.w, topY, b.z], [cx, apexY, cz]] },
        { name: 'S', verts: [[b.x, topY, b.z + b.d], [b.x + b.w, topY, b.z + b.d], [cx, apexY, cz]] },
        { name: 'W', verts: [[b.x, topY, b.z], [b.x, topY, b.z + b.d], [cx, apexY, cz]] },
      ];
      for (const face of faces) {
        primitives.push({
          type: 'quad', name: `roof_pyramid_${ri}_${face.name}`,
          verts: face.verts,
          textureKey: roofTexKey,
        });
      }

      // Flat ceiling under pyramid
      primitives.push({
        type: 'ceiling', name: `roof_pyramid_ceil_${ri}`,
        x: b.x, y: topY, z: b.z, w: b.w, h: 0, d: b.d,
        textureKey: ceilingTexKey,
        shared: true,
      });
    }
  }

  return primitives;
}
