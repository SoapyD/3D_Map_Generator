/**
 * Which merge group (config GEOMETRY.primitiveMerge.types) a primitive belongs to, or null if it is
 * never merged. Edges, ladders, ceilings, bridge walls/battlements and any `_wall_`/`_batt_` names
 * are deliberately not in any group.
 */
export function mergeGroupType(prim) {
  const name = prim.name || '';
  if (name.includes('_wall_') || name.includes('_batt_')) return null;
  if (prim.type === 'wall') return /^wall_\d+$/.test(name) ? 'wall' : null;
  if (prim.type !== 'slab' || !prim.shared || prim.solid) return null;
  if (/^pavement_\d+$/.test(name)) return 'pavement';
  if (/^floor_f\d+_/.test(name)) return 'floor';
  return null;
}
