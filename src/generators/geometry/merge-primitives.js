import { mergeGroupType } from './merge/merge-group-type.js';
import { mergeGroupKey } from './merge/merge-group-key.js';
import { mergeGroupPrims } from './merge/merge-group-prims.js';

/**
 * Primitive merge pass: joins adjacent same-texture, same-tier boxes (walls within one building,
 * pavements, floor plates) into single primitives so the OBJ spends fewer vertices on them. Pure -
 * the input list and its primitives are not mutated. Primitive order is preserved (a merged
 * primitive sits where its first constituent was).
 *
 * @param {object[]} primitives
 * @param {{ enabled: boolean, types: string[], epsilon: number }} options  GEOMETRY.primitiveMerge
 * @returns {object[]}
 */
export function mergePrimitives(primitives, options) {
  if (!options || !options.enabled) return primitives;
  const { types, epsilon } = options;

  const groups = new Map();
  for (const prim of primitives) {
    const groupType = mergeGroupType(prim);
    if (!groupType || !types.includes(groupType)) continue;
    const key = mergeGroupKey(prim, groupType, epsilon);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(prim);
  }

  const replacement = new Map();
  for (const group of groups.values()) {
    if (group.length > 1) mergeGroupPrims(group, epsilon, replacement);
  }

  const out = [];
  for (const prim of primitives) {
    if (!replacement.has(prim)) { out.push(prim); continue; }
    const merged = replacement.get(prim);
    if (merged) out.push(merged);
  }
  return out;
}
