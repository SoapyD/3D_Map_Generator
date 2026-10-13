/**
 * Key that two primitives must share to be merge candidates: same type, texture, y, h, flags and
 * name family (so `floor_fN_` and the tier it implies never change). Walls also share their
 * line (axis + the fixed cross-coordinate and thickness) so only collinear walls can join.
 */
export function mergeGroupKey(prim, groupType, epsilon) {
  const q = (v) => Math.round(v / epsilon);
  const family = prim.name.replace(/(_-?\d+)+$/, '');
  const parts = [
    groupType, prim.type, family, prim.textureKey, q(prim.y), q(prim.h),
    prim.shared, prim.emitTop, prim.emitBottom, prim.simpleBottom, prim.rotateUV, prim.axis,
  ];
  if (groupType === 'wall') {
    parts.push(prim.axis === 'x' ? `z${q(prim.z)}d${q(prim.d)}` : `x${q(prim.x)}w${q(prim.w)}`);
  }
  return parts.join('|');
}
