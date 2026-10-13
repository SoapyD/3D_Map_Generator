/**
 * Mirrors the branches of resolveTexturedMaterial
 * (src/generators/scene/resolve-textured-material.js) one for one, but returns the pool name and index.
 */

// [pool, defaultsToZero]: the resolver gives river/river_bank/street/pavement a `?? 0` index, the rest none.
const INDEXED_RULES = {
  walkway: ['walkways', false], roof: ['roofs', false], object: ['objects', false], ladder: ['ladders', false],
  river: ['rivers', true], river_bank: ['river_banks', true], street: ['streets', true], pavement: ['pavements', true],
};
const FIXED_RULES = { courtyard: 'courtyards', map_skirt: 'map_skirt', map_border: 'map_border' };

/** @returns {{ pool: string, index: number, unknown: boolean }} */
export function resolveKey(textureKey) {
  const parts = textureKey.split(':');
  const head = parts[0];
  if (head === 'floor') return { pool: parts[1] === 'base' ? 'base_map' : 'floors', index: parseInt(parts[2], 10), unknown: false };
  if (head === 'wall') return { pool: parts[1] === 'landmark' ? 'landmark_walls' : 'walls', index: parseInt(parts[2], 10), unknown: false };
  if (FIXED_RULES[head]) return { pool: FIXED_RULES[head], index: 0, unknown: false };
  if (INDEXED_RULES[head]) {
    const [pool, defaultsToZero] = INDEXED_RULES[head];
    return { pool, index: parseInt(defaultsToZero ? (parts[1] ?? 0) : parts[1], 10), unknown: false };
  }
  return { pool: 'walls', index: 0, unknown: true };
}
