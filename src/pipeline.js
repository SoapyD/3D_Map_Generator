/**
 * Shared generation pipeline: grid → … → geometry.
 *
 * The single source of truth for the procedural stage sequence, called by BOTH
 * the CLI (index.js) and the programmatic API (lib.js / generateToBuffer). They
 * used to inline their own stage lists, which silently drifted — lib.js fell
 * behind index.js (no collision matrix, missing roofs/streets/ladders) and threw
 * the moment a matrix-dependent stage ran. Keeping the order here means the
 * browser GLB and the TTS OBJ are always generated from the same geometry.
 *
 * Returns the built geometry plus the collision matrix. The CLI embeds the
 * matrix in its viewer handover and debug dumps; lib.js ignores it.
 */

import { generateGrid } from './generators/foundations/grid.js';
import { createCollisionMatrix, CELL, STAGE } from './generators/collision/matrix.js';
import { generateBuildings } from './generators/buildings/index.js';
import { generateFloors } from './generators/floors/index.js';
import { generateRoofs } from './generators/roofs/index.js';
import { generateStreets } from './generators/streets/index.js';
import { generateConnectivity } from './generators/connectivity/index.js';
import { generateLadders } from './generators/ladders/index.js';
import { generateWalls } from './generators/walls/index.js';
import { generateCover } from './generators/cover/index.js';
import { buildGeometry } from './generators/geometry/index.js';

/**
 * Run the full procedural pipeline for an already-resolved config.
 *
 * @param {object} config - fully-resolved config (DEFAULTS already merged in)
 * @param {object} rng    - seeded RNG from createRng(config.seed)
 * @param {object} [opts]
 * @param {object|null} [opts.recorder] - debug recorder for --visualize (CLI only); no-op when absent
 * @param {boolean} [opts.log]          - print per-stage banners (CLI only)
 * @returns {{ geometry: object, matrix: object }}
 */
export function runPipeline(config, rng, { recorder = null, log = false } = {}) {
  const say = log ? (m) => console.log(m) : () => {};

  // Stage 1: Grid partitioning
  say('\n[1/9] Generating city grid...');
  const gridData = generateGrid(config, rng);
  say(`  ${gridData.blocks.length} city blocks`);
  recorder?.capture(1, gridData);

  const matrix = createCollisionMatrix(
    gridData.activeArea,
    config.tiers,
    config.tierHeight,
    config.slabThickness,
  );

  // Ground-slab placeholders at Y=-slabThickness. Buildings overwrite their
  // footprints with SHELL; the rest mark non-building foundation / street areas
  // for later geometry stages.
  const slabY = -config.slabThickness;
  matrix.setWriteContext(STAGE.BUILDINGS, 0);
  for (const block of gridData.blocks) {
    matrix.fillBox(block.x, slabY, block.z, block.w, config.slabThickness, block.d, CELL.FOUNDATION_PLACEHOLDER);
  }
  for (const street of gridData.streetBounds) {
    matrix.fillBox(street.x, slabY, street.z, street.w, config.slabThickness, street.d, CELL.STREET_PLACEHOLDER);
  }

  // Stage 2: Building shells
  say('[2/9] Placing buildings...');
  const buildingData = generateBuildings(gridData, config, rng, matrix);
  say(`  ${buildingData.buildings.length} buildings`);
  recorder?.capture(3, buildingData);

  // Stage 3: Floor plates
  say('[3/9] Generating floors...');
  const floorData = generateFloors(buildingData, config, rng, matrix);
  say(`  ${floorData.floors.length} floor plates`);
  recorder?.capture(4, floorData);

  // Stage 4: Roofs
  say('[4/9] Generating roofs...');
  const roofData = generateRoofs(floorData, config, matrix);
  say(`  ${roofData.roofs.length} roof slabs`);
  recorder?.capture(5, roofData);

  // Stage 5: Streets / rivers / pavements — before connectivity so river cells are in the matrix
  say('[5/9] Generating streets and rivers...');
  const streetData = generateStreets(roofData, config, rng, matrix);
  recorder?.capture(2, streetData);
  recorder?.capture(10, streetData);
  recorder?.capture(11, streetData);

  // Stage 6: Connectivity
  say('[6/9] Generating connectivity...');
  const connectivityData = generateConnectivity(streetData, config, rng, matrix);
  say(`  ${connectivityData.connections.anchors.length} anchors, ${connectivityData.connections.candidates.length} candidate connections`);
  recorder?.capture(7, connectivityData);

  // Stage 7: Ladders — before walls so edge cells are still SHELL/FLOOR_* during the scan
  say('[7/9] Generating ladders...');
  const ladderData = generateLadders(connectivityData, config, rng, matrix);
  say(`  ${ladderData.ladders.length} ladders placed`);
  recorder?.capture(9, ladderData);

  // Stage 8: Walls
  say('[8/9] Generating walls...');
  const wallData = generateWalls(ladderData, config, rng, matrix);
  recorder?.capture(6, wallData);

  // Stage 9: Cover
  say('[9/9] Generating cover...');
  const coverData = generateCover(wallData, config, rng, matrix);
  recorder?.capture(8, coverData);

  const geometry = buildGeometry(coverData, config);
  return { geometry, matrix };
}
