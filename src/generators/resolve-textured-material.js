import { pickFromPool } from './pick/pickFromPool.js';

/**
 * Resolve a textureKey string to a material from texture pools.
 *
 * Key format: "category:index" or "category:subcategory:index"
 *   floor:base:0        -> pools.base_map[0]
 *   floor:building:2    -> pools.floors[2]
 *   wall:standard:1     -> pools.walls[1]
 *   wall:landmark:0     -> pools.landmark_walls[0]
 *   walkway:5           -> pools.walkways[5]
 *   roof:3              -> pools.roofs[3]
 *   object:5            -> pools.objects[5]
 *   courtyard           -> pools.courtyards[0]
 *   ladder:0            -> pools.ladders[0]
 */
export function resolveTexturedMaterial(textureKey, pools) {
  const parts = textureKey.split(':');

  if (parts[0] === 'floor') {
    if (parts[1] === 'base') return pickFromPool(pools.base_map, parseInt(parts[2], 10));
    return pickFromPool(pools.floors, parseInt(parts[2], 10));
  }
  if (parts[0] === 'wall') {
    if (parts[1] === 'landmark') return pickFromPool(pools.landmark_walls, parseInt(parts[2], 10));
    return pickFromPool(pools.walls, parseInt(parts[2], 10));
  }
  if (parts[0] === 'walkway') return pickFromPool(pools.walkways, parseInt(parts[1], 10));
  if (parts[0] === 'roof') return pickFromPool(pools.roofs, parseInt(parts[1], 10));
  if (parts[0] === 'object') return pickFromPool(pools.objects, parseInt(parts[1], 10));
  if (parts[0] === 'courtyard') return pickFromPool(pools.courtyards, 0);
  if (parts[0] === 'ladder') return pickFromPool(pools.ladders, parseInt(parts[1], 10));

  return pickFromPool(pools.walls, 0);
}
