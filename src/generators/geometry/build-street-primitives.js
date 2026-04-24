import { GEOMETRY } from '../../config.js';

export function buildStreetPrimitives(streets, config) {
  const h = GEOMETRY.streetThickness;
  const y = -h; // top face flush with Y=0 (ground surface)
  return streets.map((s, i) => ({
    type: 'slab', name: `street_${i}`,
    x: s.x, y, z: s.z, w: s.w, h, d: s.d,
    textureKey: 'street:0',
    emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
    shared: true,
  }));
}
