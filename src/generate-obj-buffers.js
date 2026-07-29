/**
 * Programmatic API — run the generation pipeline for a seed and return the OBJ geometry string plus
 * its texture-atlas PNG buffer in memory (for streaming into Tabletop Simulator as mesh + diffuse).
 * Shares the exact pipeline with generateToBuffer/the CLI; only the sink differs.
 */

import { DEFAULTS } from './config.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { buildObjAndAtlas } from './export/obj-geometry/build-obj-and-atlas.js';

/**
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, textureSet, …)
 * @returns {Promise<{ objString: string, atlasPngBuffer: Buffer }>}
 */
export async function generateObjToBuffers(seed, opts = {}) {
  const config = { ...DEFAULTS, ...opts, seed };
  const rng = createRng(config.seed);
  const { geometry } = runPipeline(config, rng);
  return buildObjAndAtlas(geometry, config);
}
