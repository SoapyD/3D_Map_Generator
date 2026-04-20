/**
 * Gap detection: grid-based scanning to find gaps between buildings and generate forced walkways.
 */

import { CONNECTIVITY } from '../../config.js';
import { prepopulateConnectedPairs } from './prepopulateConnectedPairs.js';
import { buildTierGrid } from './buildTierGrid.js';
import { markExistingConnections } from './markExistingConnections.js';
import { populateGridFromFloors } from './populateGridFromFloors.js';
import { populateGridFromRoofs } from './populateGridFromRoofs.js';
import { scanRowsForGaps } from './scanRowsForGaps.js';
import { scanColumnsForGaps } from './scanColumnsForGaps.js';
import { deduplicateForced } from './deduplicateForced.js';
import { limitForcedWalkways } from './limitForcedWalkways.js';

/**
 * Grid-based gap detection: build a spatial grid per tier, scan for gaps, generate forced walkways.
 */
export function detectGapsAndConnect(data, existingWalkways, existingBridges, config, rng) {
  const { tierHeight } = config;
  const buildings = data.buildings;
  const floors = data.floors;
  const walls = data.walls;
  const forced = [];

  // Grid cell size — 1 inch for precise alignment with building edges
  const cellSize = 1;
  const gridW = Math.ceil(config.mapWidth / cellSize);
  const gridD = Math.ceil(config.mapDepth / cellSize);

  // Track which building pairs already have a forced connection (shared across all tiers)
  const connectedPairs = new Set();
  prepopulateConnectedPairs(existingWalkways, buildings, connectedPairs);

  const minGap = CONNECTIVITY.forcedMinGap || 6;
  const diagTol = CONNECTIVITY.forcedDiagTolerance || 4;

  // Build a grid per tier
  for (let tier = 1; tier <= config.tiers; tier++) {
    const tierFloors = floors[tier];
    if (!tierFloors || tierFloors.sections.length < 2) continue;

    const grid = buildTierGrid(gridD, gridW);
    markExistingConnections(grid, existingWalkways, existingBridges, tierHeight, cellSize, gridD, gridW);
    populateGridFromFloors(grid, tierFloors, buildings, cellSize, gridD, gridW);
    populateGridFromRoofs(grid, data, tier, cellSize, gridD, gridW);

    // Build shared state object for scanning functions
    const state = {
      grid, gridD, gridW, cellSize, tierHeight,
      buildings, floors, walls, data, config,
      forced, connectedPairs, tierFloors, tier,
      minGap, diagTol,
    };

    scanRowsForGaps(state);
    scanColumnsForGaps(state);
  }

  const deduped = deduplicateForced(forced);
  const result = limitForcedWalkways(deduped, rng);

  if (result.length > 0) console.log('  Gap detection: ' + result.length + ' forced walkways');
  return result;
}
