/**
 * Programmatic API — run the generation pipeline for a seed and return the simplified TTS collider
 * OBJ as a string in memory (a separate, box-per-surface mesh, distinct from the visual OBJ).
 * Shares the exact pipeline with generateToBuffer/the CLI; only the sink differs.
 */

import { DEFAULTS } from './config.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { buildCollisionObj } from './export/collision-buffer.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, …)
 * @returns {Promise<string>} the collider OBJ text
 */
export async function generateColliderToBuffer(seed, opts = {}) {
  const config = { ...DEFAULTS, ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildCollisionObj(geometry).objString;
}
