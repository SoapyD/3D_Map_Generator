export function buildBuildingFootprintPrimitives(buildings, config) {
  const slabH = config.slabThickness ?? 0.2;
  return buildings.map((b, i) => ({
    type: 'slab',
    name: `building_footprint_${i}`,
    x: b.x, y: 0, z: b.z, w: b.w, h: slabH, d: b.d,
    textureKey: `floor:base:0`,
    emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
    shared: false,
  }));
}
