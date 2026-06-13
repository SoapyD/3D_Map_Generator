/**
 * Programmatic API — run the generation pipeline and return a GLB Buffer.
 *
 * Usage:
 *   import { generateToBuffer } from '3d-map-generator';
 *   const buf = await generateToBuffer(42, { tiers: 3, mapWidth: 48, mapDepth: 48 });
 *
 * Shares the exact stage sequence with the CLI via runPipeline (src/pipeline.js),
 * so the in-process GLB matches `node src/index.js` output. Only the sink differs:
 * the CLI writes GLB/OBJ files, this returns the GLB as a Buffer.
 */

import { DEFAULTS } from './config.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { buildScene } from './generators/scene/index.js';
import { buildGlbBuffer } from './export/glb-exporter.js';

/**
 * Run the full generation pipeline for the given seed and return a GLB Buffer.
 *
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, damageLevel, textureSet, debug, …)
 * @returns {Promise<Buffer>}
 */
export async function generateToBuffer(seed, opts = {}) {
  const config = { ...DEFAULTS, ...opts, seed };
  const rng = createRng(config.seed);

  const { geometry } = runPipeline(config, rng);
  const scene = buildScene(geometry, config);

  return buildGlbBuffer(scene);
}
