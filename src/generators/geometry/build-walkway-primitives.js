import { GEOMETRY } from '../../config.js';

export function buildWalkwayPrimitives(walkways) {
  const primitives = [];
  const thickness = GEOMETRY.walkwayThickness;

  for (let i = 0; i < walkways.length; i++) {
    const w = walkways[i];
    const texKey = `walkway:${w.texIndex ?? i}`;

    for (const seg of w.segments) {
      const r = seg.worldRect;
      primitives.push({
        type: 'slab', name: `walkway_${i}`,
        x: r.x, y: r.y, z: r.z, w: r.w, h: thickness, d: r.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false,
        rotateUV: r.w > r.d,
        shared: true,
      });
      if (!seg.isCrossing) {
        primitives.push({
          type: 'edges', name: `walkway_${i}`,
          x: r.x, y: r.y, z: r.z, w: r.w, h: thickness, d: r.d,
          textureKey: texKey,
        });
      }
    }
  }

  return primitives;
}
