/**
 * Merged primitive: `a` with its footprint replaced by `box`. Name and all other fields come from
 * `a` (the earlier constituent). `uvOrigin` is the first constituent's box, carried through repeated
 * merges, so exporters hash the same origin as before and the texture offset does not move.
 */
export function buildMergedPrim(a, box) {
  const uvOrigin = a.uvOrigin ?? { x: a.x, y: a.y, z: a.z, w: a.w, h: a.h, d: a.d };
  return { ...a, x: box.x, z: box.z, w: box.w, d: box.d, uvOrigin };
}
