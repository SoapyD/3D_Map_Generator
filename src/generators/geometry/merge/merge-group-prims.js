import { mergeTwoBoxes } from './merge-two-boxes.js';
import { buildMergedPrim } from './build-merged-prim.js';

/**
 * Greedy pairwise merge of one candidate group until no pair can join. Pair order is the original
 * primitive order, so the result is deterministic. A merged primitive takes the place of its first
 * constituent. Records `replacement.set(original, mergedOrNull)` for every member of the group
 * (null = absorbed into an earlier primitive).
 */
export function mergeGroupPrims(group, epsilon, replacement) {
  const entries = group.map((prim) => ({ first: prim, prim }));

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const box = mergeTwoBoxes(entries[i].prim, entries[j].prim, epsilon);
        if (!box) continue;
        entries[i].prim = buildMergedPrim(entries[i].prim, box);
        entries.splice(j, 1);
        changed = true;
        j = i; // restart the inner scan against the grown rectangle
      }
    }
  }

  for (const prim of group) replacement.set(prim, null);
  for (const e of entries) replacement.set(e.first, e.prim);
}
