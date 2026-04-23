import { STREETS } from '../../config.js';

export function buildMapSkirtPrimitives(config) {
  const { mapWidth, mapDepth } = config;
  const riverDepth = config.riverDepth ?? STREETS.riverDepth;
  const skirtH = riverDepth + 1;
  const skirtT = 1;
  const yBase  = -skirtH;

  const primitives = [];

  function panel(name, x, z, w, d, rotateUV = false) {
    primitives.push({
      type: 'slab', name,
      x, y: yBase, z, w, h: skirtH, d,
      textureKey: 'map_skirt',
      emitTop: true, emitBottom: false, simpleBottom: false,
      rotateUV, shared: true,
    });
    primitives.push({
      type: 'edges', name,
      x, y: yBase, z, w, h: skirtH, d,
      textureKey: 'map_skirt',
    });
  }

  panel('skirt_N', 0,         -skirtT,   mapWidth, skirtT);
  panel('skirt_S', 0,         mapDepth,  mapWidth, skirtT);
  panel('skirt_W', -skirtT,   0,         skirtT,   mapDepth, true);
  panel('skirt_E', mapWidth,  0,         skirtT,   mapDepth, true);

  // Bottom cap — seals below the river floor
  primitives.push({
    type: 'slab', name: 'skirt_bottom',
    x: -skirtT, y: yBase - skirtT, z: -skirtT,
    w: mapWidth + skirtT * 2, h: skirtT, d: mapDepth + skirtT * 2,
    textureKey: 'map_skirt',
    emitTop: true, emitBottom: false, simpleBottom: false,
    rotateUV: false, shared: true,
  });

  return primitives;
}
