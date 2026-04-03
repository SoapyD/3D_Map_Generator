import { GEOMETRY } from '../../config.js';

export function buildWalkwayPrimitives(walkways) {
  const primitives = [];

  for (let i = 0; i < walkways.length; i++) {
    const w = walkways[i];
    const texIdx = (w.textureId !== undefined && w.branch)
      ? walkways.findIndex(ww => ww.textureId === w.textureId && !ww.branch)
      : i;
    const name = w.blocked ? `walkway_BLOCKED_${i}` : `walkway_${i}`;

    primitives.push({
      type: 'slab', name,
      x: w.x, y: w.y, z: w.z, w: w.w, h: GEOMETRY.walkwayThickness, d: w.d,
      textureKey: `walkway:${texIdx >= 0 ? texIdx : i}`,
      emitTop: true, emitBottom: true, simpleBottom: false,
      rotateUV: w.w > w.d,
      shared: true,
    });
    primitives.push({
      type: 'edges', name,
      x: w.x, y: w.y, z: w.z, w: w.w, h: GEOMETRY.walkwayThickness, d: w.d,
      textureKey: `walkway:${texIdx >= 0 ? texIdx : i}`,
    });
  }

  return primitives;
}
