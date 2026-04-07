/**
 * Programmatic API — run the generation pipeline and return a GLB Buffer.
 *
 * Usage:
 *   import { generateToBuffer } from '3d-map-generator';
 *   const buf = await generateToBuffer(42, { tiers: 3, mapWidth: 48, mapDepth: 48 });
 */

import { DEFAULTS } from './config.js';
import { createRng } from './core/rng.js';
import { generateGrid } from './generators/grid.js';
import { generateBuildings } from './generators/buildings/index.js';
import { generateFloors } from './generators/floors/index.js';
import { generateWalls } from './generators/walls/index.js';
import { generateConnectivity } from './generators/connectivity/index.js';
import { generateCover } from './generators/cover/index.js';
import { buildGeometry } from './generators/geometry/index.js';
import { buildScene } from './generators/scene/index.js';
import { buildGlbBuffer } from './export/glb-exporter.js';

/**
 * Run the full generation pipeline for the given seed and return a GLB Buffer.
 *
 * @param {number} seed
 * @param {object} [opts] - Any keys from DEFAULTS (mapWidth, mapDepth, tiers, etc.)
 * @returns {Promise<Buffer>}
 */
export async function generateToBuffer(seed, opts = {}) {
  const config = { ...DEFAULTS, ...opts, seed };
  const rng = createRng(config.seed);

  const gridData = generateGrid(config, rng);
  const buildingData = generateBuildings(gridData, config, rng);
  const floorData = generateFloors(buildingData, config, rng);
  const wallData = generateWalls(floorData, config, rng);
  const connData = generateConnectivity(wallData, config, rng);
  const coverData = generateCover(connData, config, rng);
  const geometry = buildGeometry(coverData, config);
  const scene = buildScene(geometry, config);

  return buildGlbBuffer(scene);
}
