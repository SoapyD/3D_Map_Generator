/**
 * Programmatic API — run the generation pipeline for a seed and return the simplified TTS collider
 * OBJ as a string in memory (a separate, box-per-surface mesh, distinct from the visual OBJ).
 * Shares the exact pipeline with generateToBuffer/the CLI; only the sink differs.
 *
 * DEPRECATED: Tabletop Simulator is no longer a target. Kept (behaviour unchanged) only for consumers
 * pinned to older versions (v0.2.0). Warns once per process. See DEPRECATION in src/config.js.
 */

import { DEFAULTS } from './config.js';
import { profileDefaults } from './profiles/profile-defaults.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { warnDeprecatedOnce } from './core/warn-deprecated-once.js';
import { buildCollisionObj } from './export/collision-buffer.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, …)
 * @returns {Promise<string>} the collider OBJ text
 * @deprecated Legacy TTS export; kept for consumers pinned to v0.2.0.
 */
export async function generateColliderToBuffer(seed, opts = {}) {
  warnDeprecatedOnce('generateColliderToBuffer');
  const config = { ...DEFAULTS, ...profileDefaults(opts.profile), ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildCollisionObj(geometry).objString;
}
