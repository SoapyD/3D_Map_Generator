/**
 * Stage 4: Wall Generation — Quadrant-Driven
 *
 * For each tier of a building:
 * - Find the quadrants present on the floor ABOVE
 * - Generate up to 2 walls along the outer edges of those quadrants
 *
 * Quadrant outer edges:
 *   0: north, west
 *   1: north, east
 *   2: south, west
 *   3: south, east
 */

const WALL_QUAD_SIZE = 3;
const UPPER_REMOVAL_RATIO = 0.7;
const LOWER_REMOVAL_RATIO = 0.5;

export function generateWalls(data, config, rng) {
  const { tierHeight, wallThickness, slabThickness } = config;
  const walls = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];

    for (let tier = 0; tier < building.maxTier; tier++) {
      const baseY = tier * tierHeight + slabThickness;
      const wallHeight = tierHeight - slabThickness;

      // Get quadrants on the floor above
      const aboveTier = tier + 1;
      const aboveQuadrants = bq.tiers[aboveTier];
      if (!aboveQuadrants || aboveQuadrants.size === 0) continue;

      // Collect outer edges from the above quadrants
      const edgeSet = new Set();
      for (const q of aboveQuadrants) {
        for (const edge of QUADRANT_EDGES[q]) {
          edgeSet.add(edge);
        }
      }

      // Pick up to 2 edges
      const allEdges = rng.shuffle([...edgeSet]);
      const chosen = allEdges.slice(0, 2);

      for (const edgeLabel of chosen) {
        const wallDef = buildWall(building, edgeLabel, aboveQuadrants, baseY, wallHeight, wallThickness);
        if (!wallDef) continue;

        // Apply wall quadrant damage
        const segments = applyWallDamage(wallDef, rng);
        walls.push(...segments);
      }
    }
  }

  return { ...data, walls };
}

/**
 * Divide wall into upper/lower quadrant grid and remove some.
 * Upper row: up to 50% removed. Lower row: up to 30% removed.
 * Removals spread from first removal adjacently.
 */
function applyWallDamage(wallDef, rng) {
  const { x, z, length, height, baseY, thickness, axis } = wallDef;
  const cols = Math.max(1, Math.round(length / WALL_QUAD_SIZE));
  const rows = 2;
  const quadW = length / cols;
  const quadH = height / rows;

  const grid = Array.from({ length: cols }, () => [true, true]);

  // Upper row removal
  const maxUpperRemove = Math.floor(cols * UPPER_REMOVAL_RATIO);
  const upperToRemove = maxUpperRemove > 0 ? rng.int(0, maxUpperRemove) : 0;
  const removed = [];

  for (let r = 0; r < upperToRemove; r++) {
    if (r === 0) {
      const col = rng.int(0, cols - 1);
      grid[col][1] = false;
      removed.push({ col, row: 1 });
    } else {
      const candidates = [];
      for (const prev of removed) {
        if (prev.row !== 1) continue;
        if (prev.col > 0 && grid[prev.col - 1][1]) candidates.push(prev.col - 1);
        if (prev.col < cols - 1 && grid[prev.col + 1][1]) candidates.push(prev.col + 1);
      }
      if (candidates.length === 0) break;
      const col = rng.pick(candidates);
      grid[col][1] = false;
      removed.push({ col, row: 1 });
    }
  }

  // Lower row removal
  const maxLowerRemove = Math.floor(cols * LOWER_REMOVAL_RATIO);
  const lowerToRemove = maxLowerRemove > 0 ? rng.int(0, maxLowerRemove) : 0;

  for (let r = 0; r < lowerToRemove; r++) {
    const candidates = [];
    for (const prev of removed) {
      if (prev.row === 1 && grid[prev.col][0]) candidates.push(prev.col);
      if (prev.row === 0) {
        if (prev.col > 0 && grid[prev.col - 1][0]) candidates.push(prev.col - 1);
        if (prev.col < cols - 1 && grid[prev.col + 1][0]) candidates.push(prev.col + 1);
      }
    }
    if (candidates.length === 0) break;
    const col = rng.pick(candidates);
    grid[col][0] = false;
    removed.push({ col, row: 0 });
  }

  // Convert to segments
  const segments = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (!grid[col][row]) continue;
      const segBaseY = baseY + row * quadH;
      const offset = col * quadW;
      segments.push({
        x: axis === 'x' ? x + offset : x,
        z: axis === 'z' ? z + offset : z,
        length: quadW,
        height: quadH,
        baseY: segBaseY,
        thickness,
        axis,
      });
    }
  }

  return mergeSegments(segments);
}

/**
 * Merge adjacent segments with same height and baseY.
 */
function mergeSegments(segments) {
  if (segments.length <= 1) return segments;
  const byRow = new Map();
  for (const s of segments) {
    const key = s.baseY.toFixed(2);
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(s);
  }
  const merged = [];
  for (const [, rowSegs] of byRow) {
    rowSegs.sort((a, b) => (a.axis === 'x' ? a.x - b.x : a.z - b.z));
    let current = { ...rowSegs[0] };
    for (let i = 1; i < rowSegs.length; i++) {
      const next = rowSegs[i];
      const currEnd = current.axis === 'x' ? current.x + current.length : current.z + current.length;
      const nextStart = next.axis === 'x' ? next.x : next.z;
      if (Math.abs(currEnd - nextStart) < 0.01 && Math.abs(current.height - next.height) < 0.01) {
        current.length += next.length;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }
  return merged;
}

const QUADRANT_EDGES = {
  0: ['north', 'west'],
  1: ['north', 'east'],
  2: ['south', 'west'],
  3: ['south', 'east'],
};

function buildWall(building, edgeLabel, present, baseY, wallHeight, thickness) {
  const { x, z, w, d } = building;
  const mx = x + w / 2;
  const mz = z + d / 2;

  let wallX, wallZ, length, axis;

  switch (edgeLabel) {
    case 'north': {
      const has0 = present.has(0);
      const has1 = present.has(1);
      if (!has0 && !has1) return null;
      wallX = has0 ? x : mx;
      wallZ = z;
      length = (has0 && has1) ? w : w / 2;
      axis = 'x';
      break;
    }
    case 'south': {
      const has2 = present.has(2);
      const has3 = present.has(3);
      if (!has2 && !has3) return null;
      wallX = has2 ? x : mx;
      wallZ = z + d - thickness;
      length = (has2 && has3) ? w : w / 2;
      axis = 'x';
      break;
    }
    case 'west': {
      const has0 = present.has(0);
      const has2 = present.has(2);
      if (!has0 && !has2) return null;
      wallX = x;
      wallZ = has0 ? z : mz;
      length = (has0 && has2) ? d : d / 2;
      axis = 'z';
      break;
    }
    case 'east': {
      const has1 = present.has(1);
      const has3 = present.has(3);
      if (!has1 && !has3) return null;
      wallX = x + w - thickness;
      wallZ = has1 ? z : mz;
      length = (has1 && has3) ? d : d / 2;
      axis = 'z';
      break;
    }
    default:
      return null;
  }

  return { x: wallX, z: wallZ, length, height: wallHeight, baseY, thickness, axis };
}
