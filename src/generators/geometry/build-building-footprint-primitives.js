import { floorThickness, floorGeomY } from '../../core/levels.js';

export function buildBuildingFootprintPrimitives(buildings, config) {
  const slabH = floorThickness(config);
  const slabY = floorGeomY(0, config);
  return buildings.map((b, i) => ({
    type: 'slab',
    name: `building_footprint_${i}`,
    x: b.x, y: slabY, z: b.z, w: b.w, h: slabH, d: b.d,
    textureKey: `floor:base:0`,
    emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
    shared: false,
  }));
}
