import { CONNECTIVITY } from '../../config.js';
import { findFloorEdge } from './findFloorEdge.js';
import { findCrossAxisRange } from './findCrossAxisRange.js';
import { passesThrough } from './passesThrough.js';
import { isStackedOnForced } from './isStackedOnForced.js';
import { crossesWalkway } from './crossesWalkway.js';
import { clearBlockingWalls } from './clearBlockingWalls.js';
import { markWalkwayOnGrid } from './markWalkwayOnGrid.js';

const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

// Try to place a forced connection, return true if placed
export function tryForceConnection(axis, startBI, endBI, scanPos, state) {
  const { config, tierHeight, cellSize, gridD, gridW, forced, tier, minGap, diagTol } = state;
  // Try the exact scan position first, then nearby rows/cols within diagonal tolerance
  const positions = [scanPos];
  for (let offset = 1; offset <= diagTol; offset++) {
    positions.push(scanPos + offset);
    positions.push(scanPos - offset);
  }

  for (const pos of positions) {
    if (pos < 0 || pos >= (axis === 'x' ? gridD : gridW)) continue;

    if (axis === 'x') {
      const startX = findFloorEdge(startBI, 'x', 'end', pos, state);
      const endX = findFloorEdge(endBI, 'x', 'start', pos, state);
      if (startX === null || endX === null || endX - startX < minGap) continue;
      if (endX - startX > config.mapWidth / 2) continue;

      // Clamp walkway Z to the overlap of both endpoint floor ranges
      const startRange = findCrossAxisRange(startBI, 'x', 'end', startX, state);
      const endRange = findCrossAxisRange(endBI, 'x', 'start', endX, state);
      if (!startRange || !endRange) continue;
      const overlapMin = Math.max(startRange.min, endRange.min);
      const overlapMax = Math.min(startRange.max, endRange.max);
      if (overlapMax - overlapMin < WALKWAY_WIDTH) continue; // not enough shared range
      const clampedZ = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

      const candidate = {
        type: 'walkway', x: startX, z: clampedZ - WALKWAY_WIDTH / 2,
        w: endX - startX, d: WALKWAY_WIDTH, y: tier * tierHeight, axis: 'x', forced: true,
      };

      if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'x', state) &&
          !isStackedOnForced(candidate, forced) &&
          !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier, state)) {
        // Clear blocking walls at both endpoints (start building's east face, end building's west face)
        clearBlockingWalls(candidate, startX, null, 'east', state);
        clearBlockingWalls(candidate, endX, null, 'west', state);
        forced.push(candidate);
        markWalkwayOnGrid(candidate, state);
        return true;
      }
    } else {
      const startZ = findFloorEdge(startBI, 'z', 'end', pos, state);
      const endZ = findFloorEdge(endBI, 'z', 'start', pos, state);
      if (startZ === null || endZ === null || endZ - startZ < minGap) continue;
      if (endZ - startZ > config.mapWidth / 2) continue;

      // Clamp walkway X to the overlap of both endpoint floor ranges
      const startRange = findCrossAxisRange(startBI, 'z', 'end', startZ, state);
      const endRange = findCrossAxisRange(endBI, 'z', 'start', endZ, state);
      if (!startRange || !endRange) continue;
      const overlapMin = Math.max(startRange.min, endRange.min);
      const overlapMax = Math.min(startRange.max, endRange.max);
      if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;
      const clampedX = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

      const candidate = {
        type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: startZ,
        w: WALKWAY_WIDTH, d: endZ - startZ, y: tier * tierHeight, axis: 'z', forced: true,
      };

      if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'z', state) &&
          !isStackedOnForced(candidate, forced) &&
          !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier, state)) {
        // Clear blocking walls at both endpoints (start building's south face, end building's north face)
        clearBlockingWalls(candidate, null, startZ, 'south', state);
        clearBlockingWalls(candidate, null, endZ, 'north', state);
        forced.push(candidate);
        markWalkwayOnGrid(candidate, state);
        return true;
      }
    }
  }
  return false;
}
