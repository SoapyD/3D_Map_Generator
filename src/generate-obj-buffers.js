/**
 * Programmatic API — run the generation pipeline for a seed and return the OBJ geometry string plus
 * its texture-atlas PNG buffer in memory (for streaming into Tabletop Simulator as mesh + diffuse).
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
import { buildObjAndAtlas } from './export/obj-geometry/build-obj-and-atlas.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, textureSet, …)
 * @returns {Promise<{ objString: string, atlasPngBuffer: Buffer }>}
 * @deprecated Legacy TTS export; kept for consumers pinned to v0.2.0.
 */
export async function generateObjToBuffers(seed, opts = {}) {
  warnDeprecatedOnce('generateObjToBuffers');
  const config = { ...DEFAULTS, ...profileDefaults(opts.profile), ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildObjAndAtlas(geometry, config);
}
