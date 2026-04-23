import { GEOMETRY } from '../../config.js';

export function buildPavementPrimitives(pavements, config) {
  const h = GEOMETRY.pavementThickness;
  const y = -h; // top face flush with Y=0 (ground surface)
  return pavements.map((p, i) => ({
    type: 'slab', name: `pavement_${i}`,
    x: p.x, y, z: p.z, w: p.w, h, d: p.d,
    textureKey: 'pavement:0',
    emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
    shared: true,
  }));
}
