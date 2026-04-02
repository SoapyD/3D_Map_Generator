/**
 * Pick a material from a pool using an index (deterministic per-building).
 */
export function pickFromPool(pool, index) {
  return pool[Math.abs(index) % pool.length];
}
