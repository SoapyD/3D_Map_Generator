/**
 * Centre of a merged primitive's `uvOrigin` box (its first constituent), as the GLB UV hash
 * expects, or null for an unmerged primitive.
 */
export function uvOriginCenter(prim) {
  const o = prim.uvOrigin;
  if (!o) return null;
  return { x: o.x + o.w / 2, y: o.y + o.h / 2, z: o.z + o.d / 2 };
}
