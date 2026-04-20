import { makePairKey } from './makePairKey.js';
import { tryForceConnection } from './tryForceConnection.js';

/**
 * Scan columns for vertical gaps (walkway along Z axis).
 */
export function scanColumnsForGaps(state) {
  const { grid, gridD, gridW, cellSize, buildings, connectedPairs, minGap, config } = state;

  for (let c = 0; c < gridW; c++) {
    let lastOccupied = -1;
    let lastBI = -1;
    for (let r = 0; r < gridD; r++) {
      const cell = grid[r][c];
      if (cell.hasFloor && cell.buildingIndex >= 0) {
        if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
          const gapCells = r - lastOccupied - 1;
          if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
            const pairKey = makePairKey(lastBI, cell.buildingIndex, buildings);
            if (pairKey && !connectedPairs.has(pairKey)) {
              if (tryForceConnection('z', lastBI, cell.buildingIndex, c, state)) {
                connectedPairs.add(pairKey);
              }
            }
          }
        }
        lastOccupied = r;
        lastBI = cell.buildingIndex;
      }
    }
  }
}
