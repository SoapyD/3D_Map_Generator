/**
 * Ladder placement pipeline — five phases:
 *   1. Candidate scan  — eligible floor/roof edge cells passing exclusion rules
 *   2. Column grouping — stack candidates into ladder records with height spans
 *   3. Path discovery  — DFS chains covering ground→roof per building
 *   4. Path selection  — pick paths per building size with spacing constraints
 *   5. Output          — emit finalised ladder records onto data.ladders
 */

import { CELL } from '../collision/matrix.js';
import { LADDERS } from '../../config.js';

// ─── Direction helpers ────────────────────────────────────────────────────────

// N = −Z, S = +Z, E = +X, W = −X  (standard tile map convention)
const DIR_VEC = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz:  1 },
  E: { dx: 1, dz:  0 },
  W: { dx: -1, dz: 0 },
};

// ─── Eligible label → facing directions ──────────────────────────────────────

// Maps CELL value → array of { direction, isExternal, isRoof }
const CELL_FACINGS = new Map();

function reg(val, dirs, isExternal, isRoof) {
  CELL_FACINGS.set(val, dirs.map(d => ({ direction: d, isExternal, isRoof })));
}

// Exterior floor edges
reg(CELL.FLOOR_N,      ['N'],           true,  false);
reg(CELL.FLOOR_S,      ['S'],           true,  false);
reg(CELL.FLOOR_E,      ['E'],           true,  false);
reg(CELL.FLOOR_W,      ['W'],           true,  false);
reg(CELL.FLOOR_NE,     ['N', 'E'],      true,  false);
reg(CELL.FLOOR_NW,     ['N', 'W'],      true,  false);
reg(CELL.FLOOR_SE,     ['S', 'E'],      true,  false);
reg(CELL.FLOOR_SW,     ['S', 'W'],      true,  false);
// End cells: named by the ONE connected face; the other three are exposed
reg(CELL.FLOOR_END_N,  ['S', 'E', 'W'], true,  false);
reg(CELL.FLOOR_END_S,  ['N', 'E', 'W'], true,  false);
reg(CELL.FLOOR_END_E,  ['N', 'S', 'W'], true,  false);
reg(CELL.FLOOR_END_W,  ['N', 'S', 'E'], true,  false);
reg(CELL.FLOOR_ISLAND, ['N', 'S', 'E', 'W'], true, false);

// Interior floor edges
reg(CELL.IFLOOR_N,      ['N'],           false, false);
reg(CELL.IFLOOR_S,      ['S'],           false, false);
reg(CELL.IFLOOR_E,      ['E'],           false, false);
reg(CELL.IFLOOR_W,      ['W'],           false, false);
reg(CELL.IFLOOR_NE,     ['N', 'E'],      false, false);
reg(CELL.IFLOOR_NW,     ['N', 'W'],      false, false);
reg(CELL.IFLOOR_SE,     ['S', 'E'],      false, false);
reg(CELL.IFLOOR_SW,     ['S', 'W'],      false, false);
reg(CELL.IFLOOR_END_N,  ['S', 'E', 'W'], false, false);
reg(CELL.IFLOOR_END_S,  ['N', 'E', 'W'], false, false);
reg(CELL.IFLOOR_END_E,  ['N', 'S', 'W'], false, false);
reg(CELL.IFLOOR_END_W,  ['N', 'S', 'E'], false, false);
reg(CELL.IFLOOR_ISLAND, ['N', 'S', 'E', 'W'], false, false);

// Exterior roof edges
reg(CELL.ROOF_N,  ['N'],      true, true);
reg(CELL.ROOF_S,  ['S'],      true, true);
reg(CELL.ROOF_E,  ['E'],      true, true);
reg(CELL.ROOF_W,  ['W'],      true, true);
reg(CELL.ROOF_NE, ['N', 'E'], true, true);
reg(CELL.ROOF_NW, ['N', 'W'], true, true);
reg(CELL.ROOF_SE, ['S', 'E'], true, true);
reg(CELL.ROOF_SW, ['S', 'W'], true, true);

// Interior roof edges (values 91–98 + 100–104; 100–104 shared with IROOF_END/ISLAND)
reg(CELL.IROOF_N,      ['N'],           false, true);
reg(CELL.IROOF_S,      ['S'],           false, true);
reg(CELL.IROOF_E,      ['E'],           false, true);
reg(CELL.IROOF_W,      ['W'],           false, true);
reg(CELL.IROOF_NE,     ['N', 'E'],      false, true);
reg(CELL.IROOF_NW,     ['N', 'W'],      false, true);
reg(CELL.IROOF_SE,     ['S', 'E'],      false, true);
reg(CELL.IROOF_SW,     ['S', 'W'],      false, true);
reg(CELL.IROOF_END_N,  ['S', 'E', 'W'], false, true);
reg(CELL.IROOF_END_S,  ['N', 'E', 'W'], false, true);
reg(CELL.IROOF_END_E,  ['N', 'S', 'W'], false, true);
reg(CELL.IROOF_END_W,  ['N', 'S', 'E'], false, true);
reg(CELL.IROOF_ISLAND, ['N', 'S', 'E', 'W'], false, true);

// ─── Tier / Y helpers ─────────────────────────────────────────────────────────

function floorIndex(cy, tierHeight, slabThickness) {
  return Math.round((cy + slabThickness) / (tierHeight + slabThickness));
}

// World Y of the bottom face of a floor slab at the given tier index.
function slabY(tier, tierHeight, slabThickness) {
  return tier * (tierHeight + slabThickness) - slabThickness;
}

// ─── Building lookup ──────────────────────────────────────────────────────────

function findBuildingIndex(cx, cz, buildings, matrix) {
  const wx = cx + matrix.ox;
  const wz = cz + matrix.oz;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x && wx < b.x + b.w && wz >= b.z && wz < b.z + b.d) return i;
  }
  return -1;
}

// ─── Phase 1 — Candidate scan ────────────────────────────────────────────────

function hasConnectionNearby(cx, cy, cz, radius, matrix) {
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const v = matrix.getCell(cx + dx, cy, cz + dz);
      if (v === CELL.WALKWAY || v === CELL.WALKWAY_CROSSING || v === CELL.DOOR) return true;
    }
  }
  return false;
}

function hasAdjacentBuilding(lcx, cy, lcz, direction, range, matrix) {
  const { dx, dz } = DIR_VEC[direction];
  for (let step = 1; step <= range; step++) {
    const v = matrix.getCell(lcx + dx * step, cy, lcz + dz * step);
    if (v !== CELL.EMPTY && v !== CELL.SHELL) return true;
  }
  return false;
}

function phase1Candidates(matrix, buildings, config) {
  const { tierHeight, slabThickness, mapWidth, mapDepth } = config;
  const mapEdge   = LADDERS.mapEdgeClearance;
  const connClear = LADDERS.connectionClearance;
  const bldgClear = LADDERS.buildingClearance;
  const candidates = [];

  // Cull sets — collect candidate IDs per rule; applied after all candidates are emitted
  const cullMapEdge    = new Set();
  const cullConnection = new Set();
  const cullBuilding   = new Set();
  const cullCell       = new Set();

  for (let cy = 0; cy < matrix.maxY; cy++) {
    for (let cz = 0; cz < matrix.D; cz++) {
      for (let cx = 0; cx < matrix.W; cx++) {
        const facings = CELL_FACINGS.get(matrix.getCell(cx, cy, cz));
        if (!facings) continue;

        const bi = findBuildingIndex(cx, cz, buildings, matrix);
        if (bi < 0) continue;

        const { x: edgeWx, z: edgeWz } = matrix.cellToWorld(cx, cy, cz);
        const tier = floorIndex(cy, tierHeight, slabThickness);

        const failsMapEdge    = edgeWx < mapEdge || edgeWx > mapWidth - mapEdge ||
                                edgeWz < mapEdge || edgeWz > mapDepth - mapEdge;
        const failsConnection = hasConnectionNearby(cx, cy, cz, connClear, matrix);

        for (const { direction, isExternal, isRoof } of facings) {
          const { dx, dz } = DIR_VEC[direction];
          const lcx = cx + dx;
          const lcz = cz + dz;
          const { x: wx, y: wy, z: wz } = matrix.cellToWorld(lcx, cy, lcz);

          const id = candidates.length;
          candidates.push({ id, cx, cy, cz, lcx, lcz, wx, wy, wz, direction, isExternal, isRoof, buildingIndex: bi, tier, cullReasons: [] });

          if (failsMapEdge)    cullMapEdge.add(id);
          if (failsConnection) cullConnection.add(id);
          if (matrix.getCell(lcx, cy, lcz) !== CELL.EMPTY && matrix.getCell(lcx, cy, lcz) !== CELL.SHELL)
                               cullCell.add(id);
          if (hasAdjacentBuilding(lcx, cy, lcz, direction, bldgClear, matrix))
                               cullBuilding.add(id);
        }
      }
    }
  }

  // Tag each candidate with its cull reasons
  for (const c of candidates) {
    if (cullMapEdge.has(c.id))    c.cullReasons.push('mapEdge');
    if (cullConnection.has(c.id)) c.cullReasons.push('connection');
    if (cullCell.has(c.id))       c.cullReasons.push('cell');
    if (cullBuilding.has(c.id))   c.cullReasons.push('building');
    c.isCulled = c.cullReasons.length > 0;
  }

  return candidates;
}

// ─── Phase 2 — Column grouping ───────────────────────────────────────────────

function cullFullHeight(startTier, endTier, rng, tierHeight, slabThickness) {
  const tiers = endTier - startTier;
  if (tiers <= 1) return null;

  const side = rng.int(0, 2); // 0=top, 1=bottom, 2=both
  let topRemove    = 0;
  let bottomRemove = 0;

  if (side === 2) {
    bottomRemove = rng.int(1, Math.max(1, Math.floor((tiers - 1) / 2)));
    const remaining = tiers - 1 - bottomRemove;
    topRemove = remaining > 0 ? rng.int(1, remaining) : 0;
  } else if (side === 0) {
    topRemove = rng.int(1, tiers - 1);
  } else {
    bottomRemove = rng.int(1, tiers - 1);
  }

  const newStart = startTier + bottomRemove;
  const newEnd   = endTier   - topRemove;
  if (newEnd - newStart < 1) return null;

  const newBottomY = newStart === 0 ? 0 : slabY(newStart, tierHeight, slabThickness);
  // topY = one cell above the slab at tier (newEnd − 1)
  const newTopY = slabY(newEnd - 1, tierHeight, slabThickness) + 1;

  return { startTier: newStart, endTier: newEnd, bottomY: newBottomY, topY: newTopY };
}

function phase2Ladders(candidates, buildings, config, rng, matrix) {
  const { tierHeight, slabThickness } = config;

  // Group by ladder cell position + direction + building
  const groups = new Map();
  for (const c of candidates) {
    const key = `${c.lcx},${c.lcz},${c.direction},${c.buildingIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const ladders = [];
  let id = 0;

  for (const group of groups.values()) {
    group.sort((a, b) => a.cy - b.cy);

    const { cx, cz, lcx, lcz, direction, buildingIndex } = group[0];
    const building   = buildings[buildingIndex];
    const isExternal = group.some(c => c.isExternal);
    // Union all cull reasons from every candidate in this group
    const cullReasons = [...new Set(group.flatMap(c => c.cullReasons))];
    const lowestCy   = group[0].cy;
    const highestCy  = group[group.length - 1].cy;
    const lowestTier = floorIndex(lowestCy,  tierHeight, slabThickness);
    const highestTier= floorIndex(highestCy, tierHeight, slabThickness);

    // Walk down to find where the ladder base sits.
    // External: walk the node column (open air → reaches ground).
    // Internal: walk the edge cell column where floor slab labels live.
    const walkX = isExternal ? lcx : cx;
    const walkZ = isExternal ? lcz : cz;
    let bottomCy = 0;
    let hitsConnection = false;
    for (let walkCy = lowestCy - 1; walkCy >= 0; walkCy--) {
      const v = matrix.getCell(walkX, walkCy, walkZ);
      if (v !== CELL.EMPTY && v !== CELL.SHELL) {
        if (v === CELL.WALKWAY || v === CELL.WALKWAY_CROSSING || v === CELL.DOOR) {
          hitsConnection = true;
          if (!cullReasons.includes('connection')) cullReasons.push('connection');
        }
        bottomCy = walkCy + 1;
        break;
      }
    }

    let bottomY   = bottomCy;
    let topY      = highestCy + 1;
    const startTier = floorIndex(bottomCy, tierHeight, slabThickness);
    const endTier   = highestTier + 1;

    const height0 = topY - bottomY;
    if (height0 <= 0) continue;

    let trimSection = null;

    const height = topY - bottomY;
    if (height <= 0) continue;

    const { x: wx, z: wz } = matrix.cellToWorld(lcx, 0, lcz);
    const isNS = direction === 'N' || direction === 'S';

    // Offset the rect so it sits flush against the wall face.
    // cellToWorld returns the min corner of the ladder cell; for directions where
    // the wall face is at the cell's max edge, shift by (1 - thickness).
    const needsXOff = direction === 'W';
    const needsZOff = direction === 'N';
    const THICKNESS = 0.25;

    ladders.push({
      id:            `ladder_${buildingIndex}_${id++}`,
      buildingIndex,
      cx, cz,
      lcx, lcz,
      direction,
      isExternal,
      cullReasons,
      isCulled: cullReasons.length > 0,
      x: wx + (needsXOff ? 1 - THICKNESS : 0),
      z: wz + (needsZOff ? 1 - THICKNESS : 0),
      w: isNS ? 0.75 : THICKNESS,
      d: isNS ? THICKNESS : 0.75,
      bottomY, topY, height,
      startTier, endTier,
      trimSection,
      triggers: group.map(c => ({ cx: c.cx, cy: c.cy, cz: c.cz, isRoof: c.isRoof })),
    });
  }

  return ladders;
}

// ─── Phase 3 — Path discovery ────────────────────────────────────────────────

function dfsChain(currentTier, roofTier, byStart, usedIds) {
  if (currentTier === roofTier) return [];

  const candidates = byStart.get(currentTier) || [];
  for (const ladder of candidates) {
    if (usedIds.has(ladder.id)) continue;
    usedIds.add(ladder.id);
    const rest = dfsChain(ladder.endTier, roofTier, byStart, usedIds);
    if (rest !== null) return [ladder, ...rest];
    usedIds.delete(ladder.id);
  }

  return null;
}

function findChain(available, roofTier) {
  const byStart = new Map();
  for (const l of available) {
    if (!byStart.has(l.startTier)) byStart.set(l.startTier, []);
    byStart.get(l.startTier).push(l);
  }
  // Greedy: prefer largest span at each tier
  for (const group of byStart.values()) {
    group.sort((a, b) => (b.endTier - b.startTier) - (a.endTier - a.startTier));
  }
  return dfsChain(0, roofTier, byStart, new Set());
}

function phase3Paths(ladders, buildings) {
  const laddersByBuilding = new Map();
  for (const l of ladders) {
    if (!laddersByBuilding.has(l.buildingIndex)) laddersByBuilding.set(l.buildingIndex, []);
    laddersByBuilding.get(l.buildingIndex).push(l);
  }

  const pathsByBuilding = new Map();

  for (const [bi, bLadders] of laddersByBuilding) {
    const roofTier = buildings[bi].maxTier;
    let available  = [...bLadders];
    const paths    = [];

    while (true) {
      const chain = findChain(available, roofTier);
      if (!chain) break;

      paths.push({
        ladders:      chain,
        totalLadders: chain.length,
        directions:   new Set(chain.map(l => l.direction)),
        hasExternal:  chain.some(l => l.isExternal),
        hasInternal:  chain.some(l => !l.isExternal),
      });

      const usedIds = new Set(chain.map(l => l.id));
      available = available.filter(l => !usedIds.has(l.id));
    }

    pathsByBuilding.set(bi, paths);
  }

  return pathsByBuilding;
}

// ─── Phase 4 — Path selection ────────────────────────────────────────────────

const SIZE_QUOTA = {
  'ruins-small': 1, 'small': 1,
  'medium': 2, 'ruins-medium-h': 2, 'ruins-medium-v': 2,
  'largeA': 3, 'largeB': 3,
};

function ladderDist(a, b) {
  const ax = a.x + a.w / 2,  az = a.z + a.d / 2;
  const bx = b.x + b.w / 2,  bz = b.z + b.d / 2;
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

function dirCounts(ladderList) {
  const c = { N: 0, S: 0, E: 0, W: 0 };
  for (const l of ladderList) c[l.direction]++;
  return c;
}

function tryPick(pool, placed, rng, { relaxDirection = false, relaxProximity = false, relaxSideLimit = false } = {}) {
  const pc = dirCounts(placed);

  const valid = pool.filter(path => {
    if (!relaxProximity && placed.length > 0) {
      for (const l of path.ladders) {
        for (const p of placed) {
          if (ladderDist(l, p) < LADDERS.pathSpacing) return false;
        }
      }
    }
    if (!relaxSideLimit) {
      const pathC = dirCounts(path.ladders);
      for (const dir of ['N', 'S', 'E', 'W']) {
        if (pc[dir] + pathC[dir] > LADDERS.maxSideCount) return false;
      }
    }
    return true;
  });

  if (valid.length === 0) return null;

  if (!relaxDirection) {
    const placedDirs = new Set(placed.map(l => l.direction));
    const novel = valid.filter(p => [...p.directions].some(d => !placedDirs.has(d)));
    if (novel.length > 0) return rng.pick(novel);
  }

  return rng.pick(valid);
}

function phase4Select(pathsByBuilding, buildings, rng) {
  const result = new Map();

  for (const [bi, paths] of pathsByBuilding) {
    if (paths.length === 0) { result.set(bi, []); continue; }

    const building   = buildings[bi];
    const quota      = SIZE_QUOTA[building.size] ?? 1;
    const toSelect   = Math.min(quota, paths.length);
    const selected   = [];
    const placed     = []; // ladder objects from all selected paths so far

    for (let slot = 0; slot < toSelect; slot++) {
      let pool = paths.filter(p => !selected.includes(p));

      // Constrained slots must draw from paths with the highest totalLadders
      // medium: last 1; large: last 2
      const constrainedFrom = quota >= 3 ? 1 : (quota >= 2 ? 1 : Infinity);
      if (slot >= constrainedFrom) {
        const maxL = Math.max(...pool.map(p => p.totalLadders));
        pool = pool.filter(p => p.totalLadders === maxL);
      }

      // Progressive constraint relaxation
      let picked =
        tryPick(pool, placed, rng) ??
        tryPick(pool, placed, rng, { relaxDirection: true }) ??
        tryPick(pool, placed, rng, { relaxDirection: true, relaxProximity: true }) ??
        tryPick(pool, placed, rng, { relaxDirection: true, relaxProximity: true, relaxSideLimit: true });

      if (!picked) continue;
      selected.push(picked);
      placed.push(...picked.ladders);
    }

    result.set(bi, selected);
  }

  return result;
}

// ─── Main export ─────────────────────────────────────────────────────────────

// ─── Debug path builder ───────────────────────────────────────────────────────

const PATH_QUOTA = {
  'ruins-small': 1, 'small': 1,
  'medium': 2, 'ruins-medium-h': 2, 'ruins-medium-v': 2,
  'largeA': 3, 'largeB': 3,
};
const PATH_MIN_SPACING = 3;

function buildDebugPaths(ladderGroups, buildings, config, rng, matrix) {
  const { tierHeight, slabThickness } = config;
  const tierH = tierHeight + slabThickness;

  const byBuilding = new Map();
  for (const l of ladderGroups) {
    if (!l.isExternal || l.isCulled) continue;
    if (!byBuilding.has(l.buildingIndex)) byBuilding.set(l.buildingIndex, []);
    byBuilding.get(l.buildingIndex).push(l);
  }

  const allPaths = [];

  for (const [bi, ladders] of byBuilding) {
    const building      = buildings[bi];
    const roofTier      = building.maxTier - 1;
    const quota         = PATH_QUOTA[building.size] ?? 1;
    const placedLadders = []; // all ladders picked across all paths this building

    for (let pathIdx = 0; pathIdx < quota; pathIdx++) {
      const segments    = [];
      let   currentTier = 0;
      const usedDirs    = new Set();

      while (currentTier < roofTier) {
        // Prefer unused directions; reset if all exhausted
        let pool = ladders.filter(l => !usedDirs.has(l.direction));
        if (pool.length === 0) { usedDirs.clear(); pool = [...ladders]; }

        // Additional paths: require spacing from all already-placed ladders
        if (pathIdx > 0) {
          pool = pool.filter(l => placedLadders.every(p => ladderDist(l, p) >= PATH_MIN_SPACING));
          if (pool.length === 0) {
            // No viable ladder at this tier — skip up one and try again
            currentTier++;
            continue;
          }
        }

        if (pool.length === 0) break;

        const picked = rng.pick(pool);
        usedDirs.add(picked.direction);
        placedLadders.push(picked);

        const remaining = roofTier - currentTier;
        const nextTier  = remaining <= 2
          ? roofTier
          : Math.min(roofTier, currentTier + rng.int(1, 2));

        const keptBottomY    = Math.max(currentTier * tierH, picked.bottomY);
        const keptTopY       = Math.min(nextTier * tierH, picked.topY);
        const deletedBottomY = keptTopY;
        const deletedTopY    = picked.topY;
        const hasDeleted     = nextTier < roofTier && deletedTopY > deletedBottomY;

        // Stamp CELL.DOOR at every floor level the segment passes through, 3 cells wide
        const isNSDir    = picked.direction === 'N' || picked.direction === 'S';
        const spread     = isNSDir ? [[-1,0],[0,0],[1,0]] : [[0,-1],[0,0],[0,1]];
        const startFloor = currentTier === 0 ? 1 : currentTier;
        const endFloor   = Math.round(keptTopY / tierH);
        for (let floorIdx = startFloor; floorIdx <= endFloor; floorIdx++) {
          const baseCy = floorIdx * tierH;
          for (const [ddcx, ddcz] of spread) {
            matrix.setCell(picked.cx + ddcx, baseCy,     picked.cz + ddcz, CELL.DOOR);
            matrix.setCell(picked.cx + ddcx, baseCy + 1, picked.cz + ddcz, CELL.DOOR);
            matrix.setCell(picked.cx + ddcx, baseCy + 2, picked.cz + ddcz, CELL.DOOR);
          }
        }

        segments.push({
          x: picked.x, z: picked.z, w: picked.w, d: picked.d,
          cx: picked.cx, cz: picked.cz,
          direction: picked.direction,
          keptBottomY, keptTopY,
          hasDeleted, deletedBottomY, deletedTopY,
        });

        currentTier = nextTier;
      }

      if (segments.length > 0) allPaths.push({ buildingIndex: bi, pathIndex: pathIdx, segments });
    }
  }

  return allPaths;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateLadders(data, config, rng, matrix) {
  const candidates   = phase1Candidates(matrix, data.buildings, config);
  const ladderGroups = phase2Ladders(candidates, data.buildings, config, rng, matrix);
  const ladderPaths  = buildDebugPaths(ladderGroups, data.buildings, config, rng, matrix);
  return { ...data, ladders: [], ladderCandidates: candidates, ladderGroups, ladderPaths };
}
