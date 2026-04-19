import { makePairKey } from './makePairKey.js';
import { tryForceConnection } from './tryForceConnection.js';

/**
 * Scan rows for horizontal gaps (walkway along X axis).
 */
export function scanRowsForGaps(state) {
  const { grid, gridD, gridW, cellSize, buildings, connectedPairs, minGap, config } = state;

  for (let r = 0; r < gridD; r++) {
    let lastOccupied = -1;
    let lastBI = -1;
    for (let c = 0; c < gridW; c++) {
      const cell = grid[r][c];
      if (cell.hasFloor && cell.buildingIndex >= 0) {
        if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
          const gapCells = c - lastOccupied - 1;
          if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
            const pairKey = makePairKey(lastBI, cell.buildingIndex, buildings);
            if (pairKey && !connectedPairs.has(pairKey)) {
              if (tryForceConnection('x', lastBI, cell.buildingIndex, r, state)) {
                connectedPairs.add(pairKey);
              }
            }
          }
        }
        lastOccupied = c;
        lastBI = cell.buildingIndex;
      }
    }
  }
}
