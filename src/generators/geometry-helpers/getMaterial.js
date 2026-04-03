import { resolveDebugMaterial, resolveTexturedMaterial } from '../scene/index.js';

/**
 * Get the appropriate material for a primitive based on debug mode.
 */
export function getMaterial(prim, debug, pools) {
  if (debug) return resolveDebugMaterial(prim.name);
  return resolveTexturedMaterial(prim.textureKey, pools);
}
