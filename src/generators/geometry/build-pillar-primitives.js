export function buildPillarPrimitives(pillars, bridges, walkways) {
  const primitives = [];

  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    let texKey;
    if (p.isBridge) {
      const parentIdx = bridges.findIndex(b => b.textureId === p.textureId && !b.branch);
      texKey = `wall:landmark:${parentIdx >= 0 ? parentIdx : i}`;
    } else {
      const parentIdx = walkways.findIndex(w => w.textureId === p.textureId && !w.branch);
      texKey = `walkway:${parentIdx >= 0 ? parentIdx : i}`;
    }

    primitives.push({
      type: 'slab', name: `pillar_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: p.height, d: p.d,
      textureKey: texKey,
      emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: false,
    });
  }

  return primitives;
}
