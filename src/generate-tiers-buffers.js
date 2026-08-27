/**
 * Programmatic API — run the generation pipeline for a seed and return the per-tier split in memory:
 * a manifest, one shared texture-atlas PNG, and per-tier OBJ + collider strings (for streaming into
 * Tabletop Simulator as independently movable stacked tier objects). Shares the exact pipeline with
 * generateToBuffer/the CLI; only the sink differs.
 */

import { DEFAULTS } from './config.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { buildTierBuffers } from './export/export-tiers.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, textureSet, …)
 * @returns {Promise<{ manifest: object, atlasPngBuffer: Buffer,
 *                     tiers: Array<{ tier: number, obj: string|null, collisionObj: string|null }> }>}
 */
export async function generateTiersToBuffers(seed, opts = {}) {
  const config = { ...DEFAULTS, ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildTierBuffers(geometry, config);
}
