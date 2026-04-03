/**
 * Build slab + edge primitives for scatter-style items
 * (cover, interior cover, street scatter).
 */

export function buildBoxSlabPrimitives(items, prefix, texKey) {
  const primitives = [];
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    primitives.push({
      type: 'slab', name: `${prefix}_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: texKey(i),
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `${prefix}_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: texKey(i),
    });
  }
  return primitives;
}
