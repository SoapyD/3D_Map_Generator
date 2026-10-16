/**
 * Programmatic API — run the generation pipeline and return a GLB Buffer (generateToBuffer)
 * or the raw collision matrix and primitives (generateMapData).
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
import { levelHeight, floorThickness } from './core/levels.js';

// The in-memory OBJ + atlas, collider OBJ and per-tier split exports (generateObjToBuffers,
// generateColliderToBuffer, generateTiersToBuffers) were removed; they live in tags v0.2.0 and v0.3.0.

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

/**
 * Run the full pipeline for the given seed and return the raw map data, not a scene: the collision
 * matrix and the geometry primitives (boxes), unfiltered. Same config resolution and same
 * runPipeline as generateToBuffer, so the data matches the GLB and the CLI's geometry JSON for a seed.
 *
 * Some stages print progress with console.log; that output is suppressed here (the pipeline is
 * synchronous, so the swap cannot leak into other callers).
 *
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, profile, …)
 * @returns {{ seed: number, opts: object, matrix: object, primitives: object[] }}
 *   `opts` is the caller's opts plus `levelHeight` and `floorThickness` (the tier pitch and slab
 *   thickness the matrix was built with). `matrix` is `{ W, D, maxY, belowGround, ox, oz, cellSize, cells }`
 *   where `cells` is a Uint8Array indexed `cx + cz*W + (cy+belowGround)*W*D` (255 = empty).
 */
export function generateMapData(seed, opts = {}) {
  const config = { ...DEFAULTS, ...profileDefaults(opts.profile), ...opts, seed };
  const rng = createRng(config.seed);

  const log = console.log;
  console.log = () => {};
  let result;
  try {
    result = runPipeline(config, rng);
  } finally {
    console.log = log;
  }

  const { cells, ...grid } = result.matrix.toDebugJSON();
  return {
    seed,
    opts: { ...opts, levelHeight: levelHeight(config), floorThickness: floorThickness(config) },
    matrix: { ...grid, cells: Uint8Array.from(cells) },
    primitives: result.geometry.primitives,
  };
}
