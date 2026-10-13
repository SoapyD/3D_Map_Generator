/**
 * Programmatic API — run the generation pipeline and return a GLB Buffer.
 *
 * Usage:
 *   import { generateToBuffer } from '3d-map-generator';
 *   const buf = await generateToBuffer(42, { tiers: 3, mapWidth: 48, mapDepth: 48 });
 *
 * Shares the exact stage sequence with the CLI via runPipeline (src/pipeline.js),
 * so the in-process GLB matches `node src/index.js` output. Only the sink differs:
 * the CLI writes the GLB (and geometry JSON) to files, this returns the GLB as a Buffer.
 */

import { DEFAULTS } from './config.js';
import { profileDefaults } from './profiles/profile-defaults.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { buildScene } from './generators/scene/index.js';
import { buildGlbBuffer } from './export/glb-exporter.js';

// DEPRECATED legacy entry points (each warns once per process): in-memory OBJ + atlas PNG and the separate
// collider OBJ for Tabletop Simulator. Kept unchanged only for consumers pinned to older versions (v0.2.0);
// new code should use generateToBuffer (GLB) and the primitives + collision matrix.
export { generateObjToBuffers } from './generate-obj-buffers.js';
export { generateColliderToBuffer } from './generate-collider-buffer.js';
// DEPRECATED: per-tier split (manifest + shared atlas + per-tier OBJ/collider) for the legacy TTS elevator/reveal feature.
export { generateTiersToBuffers } from './generate-tiers-buffers.js';

/**
 * Run the full generation pipeline for the given seed and return a GLB Buffer.
 *
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, damageLevel, textureSet, debug, …)
 * @returns {Promise<Buffer>}
 */
export async function generateToBuffer(seed, opts = {}) {
  const config = { ...DEFAULTS, ...profileDefaults(opts.profile), ...opts, seed };
  const rng = createRng(config.seed);

  const { geometry } = runPipeline(config, rng);
  const scene = buildScene(geometry, config);

  return buildGlbBuffer(scene);
}
