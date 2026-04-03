/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

import { BUILDING } from '../../config.js';
import { getLayoutSpecs } from './getLayoutSpecs.js';
import { placeSmallBuildings } from './placeSmallBuildings.js';
import { placeBigBuildings } from './placeBigBuildings.js';
import { cullBuildings } from './cullBuildings.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * @param {{ blocks: Array<{x,z,w,d}> }} gridData
 * @param {object} config
 * @param {object} rng
 * @returns {{ buildings: Array, blocks: Array, streets: Array }}
 */
export function generateBuildings(gridData, config, rng) {
  const { tiers } = config;

  // Use the average small footprint size to determine grid count
  const avgSize = (FOOTPRINTS.small.min + FOOTPRINTS.small.max) / 2;
  const minCellSize = avgSize * BUILDING.cellSizeMultiplier;

  // Figure out how many fit, then stretch the cell size to fill the map
  const cols = Math.floor(config.mapWidth / minCellSize);
  const rows = Math.floor(config.mapDepth / minCellSize);
  const cellW = config.mapWidth / cols;
  const cellD = config.mapDepth / rows;

  const buildings = placeSmallBuildings(cols, rows, cellW, cellD, config, rng, tiers);

  // Place larger buildings one at a time, validating each against existing buildings.
  // Small buildings earmarked for displacement are restored if the big building can't be placed.
  const layout = rng.int(0, 4);
  const specs = getLayoutSpecs(layout, config);

  const { placedBig, displacedByBig } = placeBigBuildings(buildings, specs, config, rng, tiers);

  // Surviving small buildings = all except those displaced by big buildings
  const surviving = buildings.filter(b => !displacedByBig.includes(b));

  const { finalBuildings, deletedBuildings } = cullBuildings(surviving, placedBig, displacedByBig, rng);

  return { ...gridData, buildings: [...placedBig, ...finalBuildings], deletedBuildings };
}
