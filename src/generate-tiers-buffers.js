/**
 * Programmatic API — run the generation pipeline for a seed and return the per-tier split in memory:
 * a manifest, one shared texture-atlas PNG, and per-tier OBJ + collider strings (for streaming into
 * Tabletop Simulator as independently movable stacked tier objects). Shares the exact pipeline with
 * generateToBuffer/the CLI; only the sink differs.
 *
 * DEPRECATED: Tabletop Simulator is no longer a target. Kept (behaviour unchanged) only for consumers
 * pinned to older versions (v0.2.0). Warns once per process. See DEPRECATION in src/config.js.
 */

import { DEFAULTS } from './config.js';
import { profileDefaults } from './profiles/profile-defaults.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { warnDeprecatedOnce } from './core/warn-deprecated-once.js';
import { buildTierBuffers } from './export/export-tiers.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, textureSet, …)
 * @returns {Promise<{ manifest: object, atlasPngBuffer: Buffer,
 *                     tiers: Array<{ tier: number, obj: string|null, collisionObj: string|null }> }>}
 * @deprecated Legacy TTS export; kept for consumers pinned to v0.2.0.
 */
export async function generateTiersToBuffers(seed, opts = {}) {
  warnDeprecatedOnce('generateTiersToBuffers');
  const config = { ...DEFAULTS, ...profileDefaults(opts.profile), ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildTierBuffers(geometry, config);
}
