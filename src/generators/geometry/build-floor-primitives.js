import { findBuilding } from '../building-lookup/index.js';
import { floorTextureKey } from '../floor-texture-key.js';
import { getEdgeGaps } from '../geometry-helpers/index.js';

export function buildFloorPrimitives(floors, buildings, config) {
  const primitives = [];

  for (const floor of floors) {
    const y = floor.yCollisionLevel; // cellSize=1" so cell index = world Y in inches
    const texKey = floorTextureKey(floor.buildingIndex, buildings);

    for (const rect of floor.rects) {
      const name = `floor_f${floor.floorIndex}_${Math.round(rect.x)}_${Math.round(rect.z)}`;

      primitives.push({
        type: 'slab', name,
        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
        shared: true,
      });

      const edgeGaps = {};
      for (const side of ['north', 'south', 'west', 'east']) {
        edgeGaps[side] = getEdgeGaps(rect, side, floor.rects);
      }
      primitives.push({
        type: 'edges', name,
        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
        textureKey: texKey, edgeGaps,
      });
    }
  }

  return primitives;
}
