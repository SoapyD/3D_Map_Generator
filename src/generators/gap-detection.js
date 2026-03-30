/**
 * Gap detection: grid-based scanning to find gaps between buildings and generate forced walkways.
 */

import { CONNECTIVITY } from '../config.js';

const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

/**
 * Grid-based gap detection: build a spatial grid per tier, scan for gaps, generate forced walkways.
 */
export function detectGapsAndConnect(data, existingWalkways, existingBridges, config, rng) {
  const { tierHeight, slabThickness } = config;
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

  // Resolve building index to its group (textureGroup or own index)
  function bldGroup(bi) {
    if (bi < 0 || bi >= buildings.length) return bi;
    const tg = buildings[bi].textureGroup;
    return tg !== undefined ? tg : bi;
  }

  function makePairKey(a, b) {
    const ga = bldGroup(a), gb = bldGroup(b);
    if (ga === gb) return null; // same building/composite — skip
    return Math.min(ga, gb) + ':' + Math.max(ga, gb);
  }

  // Also pre-populate from existing walkways/bridges
  function findBldForPoint(x, z) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (x >= b.x - 1.5 && x <= b.x + b.w + 1.5 && z >= b.z - 1.5 && z <= b.z + b.d + 1.5) return i;
    }
    return -1;
  }
  for (const ew of existingWalkways) {
    let s, e;
    if (ew.axis === 'x') {
      s = findBldForPoint(ew.x, ew.z + (ew.d || 2) / 2);
      e = findBldForPoint(ew.x + ew.w, ew.z + (ew.d || 2) / 2);
    } else {
      s = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z);
      e = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z + ew.d);
    }
    if (s >= 0 && e >= 0 && s !== e) {
      const pk = makePairKey(s, e);
      if (pk) connectedPairs.add(pk);
    }
  }

  // Build a grid per tier
  for (let tier = 1; tier <= config.tiers; tier++) {
    const tierFloors = floors[tier];
    if (!tierFloors || tierFloors.sections.length < 2) continue;

    // Create grid: each cell = { buildingIndex, hasFloor, walkways: [{axis, tier}] }
    const grid = Array.from({ length: gridD }, () =>
      Array.from({ length: gridW }, () => ({ buildingIndex: -1, hasFloor: false, walkways: [] }))
    );

    // Mark existing walkways/bridges on the grid with their axis and tier
    for (const ew of [...existingWalkways, ...existingBridges]) {
      const ewTier = Math.round(ew.y / tierHeight);
      const c0 = Math.floor(ew.x / cellSize);
      const c1 = Math.floor((ew.x + ew.w - 0.01) / cellSize);
      const r0 = Math.floor(ew.z / cellSize);
      const r1 = Math.floor((ew.z + ew.d - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          grid[r][c].walkways.push({ axis: ew.axis, tier: ewTier });
        }
      }
    }

    // Populate grid from floor sections
    for (const section of tierFloors.sections) {
      // Find which building this section belongs to
      let bi = -1;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (section.x >= b.x - 0.5 && section.x + section.w <= b.x + b.w + 0.5 &&
            section.z >= b.z - 0.5 && section.z + section.d <= b.z + b.d + 0.5) {
          bi = i;
          break;
        }
      }

      // Fill grid cells covered by this section
      const col0 = Math.floor(section.x / cellSize);
      const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
      const row0 = Math.floor(section.z / cellSize);
      const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
      for (let r = row0; r <= row1 && r < gridD; r++) {
        for (let c = col0; c <= col1 && c < gridW; c++) {
          if (r >= 0 && c >= 0) {
            grid[r][c].hasFloor = true;
            grid[r][c].buildingIndex = bi;
          }
        }
      }
    }

    // Also populate grid from roof sections at this tier (roofs are walkable surfaces)
    if (data.roofs) {
      for (const r of data.roofs) {
        if (r.tier !== tier) continue;
        const section = r.section || r.building;
        if (!section) continue;

        let bi = r.buildingIndex;
        if (bi === undefined || bi < 0) bi = -1;

        const col0 = Math.floor(section.x / cellSize);
        const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
        const row0 = Math.floor(section.z / cellSize);
        const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
        for (let row = row0; row <= row1 && row < gridD; row++) {
          for (let c = col0; c <= col1 && c < gridW; c++) {
            if (row >= 0 && c >= 0) {
              grid[row][c].hasFloor = true;
              if (bi >= 0) grid[row][c].buildingIndex = bi;
            }
          }
        }
      }
    }

    // Helper: mark a walkway's cells on the grid
    function markWalkwayOnGrid(w) {
      const wTier = Math.round(w.y / tierHeight);
      const c0 = Math.floor(w.x / cellSize);
      const c1 = Math.floor((w.x + w.w - 0.01) / cellSize);
      const r0 = Math.floor(w.z / cellSize);
      const r1 = Math.floor((w.z + w.d - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          grid[r][c].walkways.push({ axis: w.axis, tier: wTier });
        }
      }
    }

    // Helper: check if a proposed walkway crosses a cell with an existing walkway at the same tier
    // Blocks ANY axis crossing at the same tier (prevents criss-crossing)
    function crossesWalkway(wx, wz, ww, wd, wAxis, wTier) {
      const c0 = Math.floor(wx / cellSize);
      const c1 = Math.floor((wx + ww - 0.01) / cellSize);
      const r0 = Math.floor(wz / cellSize);
      const r1 = Math.floor((wz + wd - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          for (const ew of grid[r][c].walkways) {
            if (ew.tier === wTier) return true;
          }
        }
      }
      return false;
    }

    // Helper: check if a proposed walkway passes through a floor or roof at the same tier
    // wAxis: 'x' or 'z' — the axis the walkway runs along
    function passesThrough(wx, wz, ww, wd, wTier, wAxis) {
      // Check floor sections at this tier — block if walkway passes through along its travel axis
      const fl = floors[wTier];
      if (fl) {
        for (const s of fl.sections) {
          const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
          // Only block if there's significant overlap along the walkway's travel direction
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      // Check roofs at this tier
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier !== wTier) continue;
          const s = r.section || r.building;
          if (!s) continue;
          const sw = s.w || 0, sd = s.d || 0;
          const overlapX = Math.min(wx + ww, s.x + sw) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + sd) - Math.max(wz, s.z);
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      // Check floors at other tiers — only block SAME orientation overlaps
      // A N/S walkway shouldn't be blocked by a floor that an E/W walkway would pass through
      for (let t = 1; t <= config.tiers; t++) {
        if (t === wTier) continue;
        if (wTier > t) continue; // only block if walkway is at or below this tier
        const otherFl = floors[t];
        if (!otherFl) continue;
        for (const s of otherFl.sections) {
          const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      return false;
    }

    // Helper: check if a proposed walkway stacks on another FORCED connection (same axis, different tier, XZ overlap)
    // Allows stacking on regular walkways — forced connections fill critical gaps
    function isStackedOnForced(w) {
      for (const ew of forced) {
        if (ew.axis !== w.axis) continue;
        if (Math.abs(ew.y - w.y) < 0.5) continue;
        if (w.x < ew.x + ew.w && w.x + w.w > ew.x && w.z < ew.z + ew.d && w.z + w.d > ew.z) {
          return true;
        }
      }
      return false;
    }

    // Helper: find the actual floor section edge for a building at this tier near a grid position
    function findFloorEdge(bi, axis, side, gridPos) {
      const allSections = [...(tierFloors ? tierFloors.sections : [])];
      // Also check roofs at this tier
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier === tier && r.section) allSections.push(r.section);
        }
      }
      const bld = buildings[bi];
      if (!bld) return null;
      let bestEdge = null;
      for (const s of allSections) {
        if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
            s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;

        if (axis === 'x') {
          const rowZ = gridPos * cellSize;
          if (s.z <= rowZ + cellSize && s.z + s.d >= rowZ) {
            const edge = side === 'end' ? s.x + s.w : s.x;
            if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
          }
        } else {
          const colX = gridPos * cellSize;
          if (s.x <= colX + cellSize && s.x + s.w >= colX) {
            const edge = side === 'end' ? s.z + s.d : s.z;
            if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
          }
        }
      }
      return bestEdge;
    }

    const minGap = CONNECTIVITY.forcedMinGap || 6;
    const diagTol = CONNECTIVITY.forcedDiagTolerance || 4;

    // Helper: at a forced connection endpoint, find blocking walls and clear them if >50% coverage
    // Returns false if the endpoint has no accessible floor (no connection possible)
    function clearBlockingWalls(candidate, endpointX, endpointZ, facingDir) {
      // facingDir: 'east'|'west'|'north'|'south' — the building face the walkway arrives at
      const wt = config.wallThickness;
      const tierY = candidate.y;
      const tierH = config.tierHeight;

      // Determine the cross-axis span of the walkway at this endpoint
      let crossMin, crossMax;
      if (candidate.axis === 'x') {
        crossMin = candidate.z;
        crossMax = candidate.z + candidate.d;
      } else {
        crossMin = candidate.x;
        crossMax = candidate.x + candidate.w;
      }
      const walkwaySpan = crossMax - crossMin;

      // Find wall segments at this face that overlap the walkway's cross-axis span
      const blocking = [];
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        // Wall must be at the right tier (baseY within this tier's range)
        if (w.baseY < tierY - tierH + 0.1 || w.baseY > tierY + 0.1) continue;

        if (facingDir === 'east' || facingDir === 'west') {
          // East/west faces: wall runs along Z axis
          if (w.axis !== 'z') continue;
          // Wall X must be flush with the endpoint
          if (Math.abs(w.x - endpointX) > wt + 0.5 && Math.abs(w.x + wt - endpointX) > 0.5) continue;
          // Check Z overlap with walkway span
          const overlapMin = Math.max(w.z, crossMin);
          const overlapMax = Math.min(w.z + w.length, crossMax);
          if (overlapMax > overlapMin) {
            blocking.push({ index: i, overlap: overlapMax - overlapMin });
          }
        } else {
          // North/south faces: wall runs along X axis
          if (w.axis !== 'x') continue;
          // Wall Z must be flush with the endpoint
          if (Math.abs(w.z - endpointZ) > wt + 0.5 && Math.abs(w.z + wt - endpointZ) > 0.5) continue;
          // Check X overlap with walkway span
          const overlapMin = Math.max(w.x, crossMin);
          const overlapMax = Math.min(w.x + w.length, crossMax);
          if (overlapMax > overlapMin) {
            blocking.push({ index: i, overlap: overlapMax - overlapMin });
          }
        }
      }

      if (blocking.length === 0) return true; // no walls blocking, all good

      const totalBlocked = blocking.reduce((sum, b) => sum + b.overlap, 0);
      const coverage = totalBlocked / walkwaySpan;

      if (coverage > 0.5) {
        // Wall blocks >50% — delete the blocking wall segments to make room
        const toRemove = blocking.map(b => b.index).sort((a, b) => b - a); // reverse order for safe splice
        for (const idx of toRemove) {
          walls.splice(idx, 1);
        }
      }
      // coverage <= 50%: leave walls as-is, models can get through
      return true;
    }

    // Helper: find the cross-axis range of floor/roof sections at a building's endpoint edge
    // Returns { min, max } or null if no floor found at that edge
    function findCrossAxisRange(bi, edgeAxis, edgeSide, edgePos) {
      const bld = buildings[bi];
      if (!bld) return null;
      const allSections = [...(tierFloors ? tierFloors.sections : [])];
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier === tier && r.section) allSections.push(r.section);
        }
      }
      let rangeMin = Infinity, rangeMax = -Infinity;
      for (const s of allSections) {
        if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
            s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;
        if (edgeAxis === 'x') {
          const sEdge = edgeSide === 'end' ? s.x + s.w : s.x;
          if (Math.abs(sEdge - edgePos) > 0.5) continue;
          if (s.z < rangeMin) rangeMin = s.z;
          if (s.z + s.d > rangeMax) rangeMax = s.z + s.d;
        } else {
          const sEdge = edgeSide === 'end' ? s.z + s.d : s.z;
          if (Math.abs(sEdge - edgePos) > 0.5) continue;
          if (s.x < rangeMin) rangeMin = s.x;
          if (s.x + s.w > rangeMax) rangeMax = s.x + s.w;
        }
      }
      return rangeMin < rangeMax ? { min: rangeMin, max: rangeMax } : null;
    }

    // Helper: try to place a forced connection, return true if placed
    function tryForceConnection(axis, startBI, endBI, scanPos) {
      // Try the exact scan position first, then nearby rows/cols within diagonal tolerance
      const positions = [scanPos];
      for (let offset = 1; offset <= diagTol; offset++) {
        positions.push(scanPos + offset);
        positions.push(scanPos - offset);
      }

      for (const pos of positions) {
        if (pos < 0 || pos >= (axis === 'x' ? gridD : gridW)) continue;

        if (axis === 'x') {
          const startX = findFloorEdge(startBI, 'x', 'end', pos);
          const endX = findFloorEdge(endBI, 'x', 'start', pos);
          if (startX === null || endX === null || endX - startX < minGap) continue;
          if (endX - startX > config.mapWidth / 2) continue;

          // Clamp walkway Z to the overlap of both endpoint floor ranges
          const startRange = findCrossAxisRange(startBI, 'x', 'end', startX);
          const endRange = findCrossAxisRange(endBI, 'x', 'start', endX);
          if (!startRange || !endRange) continue;
          const overlapMin = Math.max(startRange.min, endRange.min);
          const overlapMax = Math.min(startRange.max, endRange.max);
          if (overlapMax - overlapMin < WALKWAY_WIDTH) continue; // not enough shared range
          const clampedZ = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

          const candidate = {
            type: 'walkway', x: startX, z: clampedZ - WALKWAY_WIDTH / 2,
            w: endX - startX, d: WALKWAY_WIDTH, y: tier * tierHeight, axis: 'x', forced: true,
          };

          if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'x') &&
              !isStackedOnForced(candidate) &&
              !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier)) {
            // Clear blocking walls at both endpoints (start building's east face, end building's west face)
            clearBlockingWalls(candidate, startX, null, 'east');
            clearBlockingWalls(candidate, endX, null, 'west');
            forced.push(candidate);
            markWalkwayOnGrid(candidate);
            return true;
          }
        } else {
          const startZ = findFloorEdge(startBI, 'z', 'end', pos);
          const endZ = findFloorEdge(endBI, 'z', 'start', pos);
          if (startZ === null || endZ === null || endZ - startZ < minGap) continue;
          if (endZ - startZ > config.mapWidth / 2) continue;

          // Clamp walkway X to the overlap of both endpoint floor ranges
          const startRange = findCrossAxisRange(startBI, 'z', 'end', startZ);
          const endRange = findCrossAxisRange(endBI, 'z', 'start', endZ);
          if (!startRange || !endRange) continue;
          const overlapMin = Math.max(startRange.min, endRange.min);
          const overlapMax = Math.min(startRange.max, endRange.max);
          if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;
          const clampedX = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

          const candidate = {
            type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: startZ,
            w: WALKWAY_WIDTH, d: endZ - startZ, y: tier * tierHeight, axis: 'z', forced: true,
          };

          if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'z') &&
              !isStackedOnForced(candidate) &&
              !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier)) {
            // Clear blocking walls at both endpoints (start building's south face, end building's north face)
            clearBlockingWalls(candidate, null, startZ, 'south');
            clearBlockingWalls(candidate, null, endZ, 'north');
            forced.push(candidate);
            markWalkwayOnGrid(candidate);
            return true;
          }
        }
      }
      return false;
    }

    // Scan rows for horizontal gaps (walkway along X axis)
    for (let r = 0; r < gridD; r++) {
      let lastOccupied = -1;
      let lastBI = -1;
      for (let c = 0; c < gridW; c++) {
        const cell = grid[r][c];
        if (cell.hasFloor && cell.buildingIndex >= 0) {
          if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
            const gapCells = c - lastOccupied - 1;
            if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
              const pairKey = makePairKey(lastBI, cell.buildingIndex);
              if (pairKey && !connectedPairs.has(pairKey)) {
                if (tryForceConnection('x', lastBI, cell.buildingIndex, r)) {
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

    // Scan columns for vertical gaps (walkway along Z axis)
    for (let c = 0; c < gridW; c++) {
      let lastOccupied = -1;
      let lastBI = -1;
      for (let r = 0; r < gridD; r++) {
        const cell = grid[r][c];
        if (cell.hasFloor && cell.buildingIndex >= 0) {
          if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
            const gapCells = r - lastOccupied - 1;
            if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
              const pairKey = makePairKey(lastBI, cell.buildingIndex);
              if (pairKey && !connectedPairs.has(pairKey)) {
                if (tryForceConnection('z', lastBI, cell.buildingIndex, c)) {
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

  // Deduplicate — remove forced walkways that overlap each other in XZ
  const deduped = [];
  for (const fw of forced) {
    let overlaps = false;
    for (const existing of deduped) {
      if (existing.axis !== fw.axis) continue;
      if (Math.abs(existing.y - fw.y) > 0.5) continue;
      if (fw.x < existing.x + existing.w + 1 && fw.x + fw.w > existing.x - 1 &&
          fw.z < existing.z + existing.d + 1 && fw.z + fw.d > existing.z - 1) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) deduped.push(fw);
  }

  // Limit to a reasonable number — keep the longest ones (biggest gaps are most useful)
  deduped.sort((a, b) => {
    const lenA = a.axis === 'x' ? a.w : a.d;
    const lenB = b.axis === 'x' ? b.w : b.d;
    return lenB - lenA;
  });
  const countRange = CONNECTIVITY.forcedMaxCount;
  const maxForced = Array.isArray(countRange)
    ? Math.min(deduped.length, rng.int(countRange[0], countRange[1]))
    : Math.min(deduped.length, countRange || 15);
  const result = deduped.slice(0, maxForced);

  if (result.length > 0) console.log('  Gap detection: ' + result.length + ' forced walkways');
  return result;
}
