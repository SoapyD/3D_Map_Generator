/**
 * Stage 2: Building Footprint Generation
 *
 * Uses a treemap algorithm to fill each foundation block with buildings
 * snapped to the BBD grid. Buildings are sized as small (1×1 BBD),
 * medium (2×2 BBD), largeA (2×3 BBD), or largeB (3×2 BBD).
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

import { CELL, STAGE } from '../collision/matrix.js';
import { shellHeight } from '../../core/levels.js';
import { treemapBuildings } from './treemap-buildings.js';
// import { placeSmallBuildings } from './placeSmallBuildings.js';  // old system — random float-positioned buildings
// import { getLayoutSpecs } from './getLayoutSpecs.js';            // old system — big building layout strategies
// import { placeBigBuildings } from './placeBigBuildings.js';      // old system — depends on shape builders
// import { cullBuildings } from './cullBuildings.js';              // old system — post-placement overlap culling

/**
 * @param {{ blocks, streetBounds, activeArea }} gridData
 * @param {object} config
 * @param {object} rng
 * @param {object} matrix - collision matrix
 * @returns {{ buildings: Array, blocks: Array }}
 */
export function generateBuildings(gridData, config, rng, matrix) {
  const { tiers } = config;

  const buildings = treemapBuildings(gridData.blocks, rng, tiers);

  // Write building shells into the collision matrix.
  // Shells start at the ground slab cell (Y=-slabThickness) so walls begin at Y=0, and run up to
  // and including the topmost (roof) slab cell — see shellHeight() in src/core/levels.js.
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    matrix.setWriteContext(STAGE.BUILDINGS, i);
    matrix.fillBox(b.x, -config.slabThickness, b.z, b.w, shellHeight(b.maxTier, config), b.d, CELL.SHELL);
  }

  return { ...gridData, buildings };
}
