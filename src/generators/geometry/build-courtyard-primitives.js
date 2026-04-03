import { GEOMETRY } from '../../config.js';

export function buildCourtyardPrimitives(deletedFootprints) {
  const primitives = [];
  for (let i = 0; i < deletedFootprints.length; i++) {
    const df = deletedFootprints[i];
    primitives.push({
      type: 'slab', name: `deleted_${i}`,
      x: df.x, y: GEOMETRY.courtyardY, z: df.z, w: df.w, h: GEOMETRY.courtyardThickness, d: df.d,
      textureKey: 'courtyard',
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `deleted_${i}`,
      x: df.x, y: GEOMETRY.courtyardY, z: df.z, w: df.w, h: GEOMETRY.courtyardThickness, d: df.d,
      textureKey: 'courtyard',
    });
  }
  return primitives;
}
