import { GEOMETRY, STREETS } from '../../config.js';

export function buildRiverPrimitives(rivers) {
  const primitives = [];
  const depth = STREETS.riverDepth;
  const h     = GEOMETRY.riverThickness;

  for (let ri = 0; ri < rivers.length; ri++) {
    for (let i = 0; i < rivers[ri].rects.length; i++) {
      const r = rivers[ri].rects[i];
      primitives.push({
        type: 'slab', name: `river_${ri}_${i}`,
        x: r.x, y: -depth, z: r.z, w: r.w, h, d: r.d,
        textureKey: 'river:0',
        emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
        shared: true,
      });
    }
  }
  return primitives;
}
