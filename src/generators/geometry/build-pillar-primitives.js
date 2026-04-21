export function buildPillarPrimitives(pillars) {
  const primitives = [];

  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const texKey = p.connectionType?.startsWith('bridge_')
      ? `wall:landmark:${i}`
      : `walkway:${i}`;

    primitives.push({
      type: 'slab', name: `pillar_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: p.h, d: p.d,
      textureKey: texKey,
      emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: false,
    });
  }

  return primitives;
}
