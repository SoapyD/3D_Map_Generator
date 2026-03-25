/**
 * Stage 4: Wall Generation — Quadrant-Driven
 *
 * Placement:
 * - For each tier, find quadrants present on the floor ABOVE
 * - Generate up to 2 walls along the outer edges of those quadrants
 *
 * Wall damage (quadrant system):
 * - Each wall is divided into a grid of quadrants: columns × 2 rows (upper/lower)
 * - Column count = wall length / WALL_QUAD_SIZE (3")
 * - Up to 30% of quadrants can be removed
 * - First removal is random, subsequent removals must be adjacent to previous
 *
 * Quadrant outer edges:
 *   0: north, west
 *   1: north, east
 *   2: south, west
 *   3: south, east
 */

const WALL_QUAD_SIZE = 3; // inches — matches small building floor quadrant scale
const UPPER_REMOVAL_RATIO = 0.5;
const LOWER_REMOVAL_RATIO = 0.3;

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
        const wallDef = getWallDimensions(building, edgeLabel, aboveQuadrants, wallThickness);
        if (!wallDef) continue;

        // Divide wall into quadrants and apply damage
        const segments = buildDamagedWall(
          wallDef.x, wallDef.z, wallDef.length, wallHeight, baseY, wallThickness, wallDef.axis, rng,
        );
        walls.push(...segments);
      }
    }
  }

  return { ...data, walls };
}

const QUADRANT_EDGES = {
  0: ['north', 'west'],
  1: ['north', 'east'],
  2: ['south', 'west'],
  3: ['south', 'east'],
};

/**
 * Get the position and length for a wall on a given edge.
 */
function getWallDimensions(building, edgeLabel, present, thickness) {
  const { x, z, w, d } = building;
  const mx = x + w / 2;
  const mz = z + d / 2;

  switch (edgeLabel) {
    case 'north': {
      const has0 = present.has(0);
      const has1 = present.has(1);
      if (!has0 && !has1) return null;
      return { x: has0 ? x : mx, z: z, length: (has0 && has1) ? w : w / 2, axis: 'x' };
    }
    case 'south': {
      const has2 = present.has(2);
      const has3 = present.has(3);
      if (!has2 && !has3) return null;
      return { x: has2 ? x : mx, z: z + d - thickness, length: (has2 && has3) ? w : w / 2, axis: 'x' };
    }
    case 'west': {
      const has0 = present.has(0);
      const has2 = present.has(2);
      if (!has0 && !has2) return null;
      return { x: x, z: has0 ? z : mz, length: (has0 && has2) ? d : d / 2, axis: 'z' };
    }
    case 'east': {
      const has1 = present.has(1);
      const has3 = present.has(3);
      if (!has1 && !has3) return null;
      return { x: x + w - thickness, z: has1 ? z : mz, length: (has1 && has3) ? d : d / 2, axis: 'z' };
    }
  }
  return null;
}

/**
 * Divide a wall into a grid of quadrants (cols × 2 rows),
 * remove up to 30% with adjacency spreading, then output remaining as segments.
 */
function buildDamagedWall(wallX, wallZ, length, height, baseY, thickness, axis, rng) {
  const cols = Math.max(1, Math.round(length / WALL_QUAD_SIZE));
  const rows = 2;
  const quadW = length / cols;
  const quadH = height / rows;
  const totalQuads = cols * rows;

  // Build grid: true = present, false = removed
  const grid = Array.from({ length: cols }, () => [true, true]); // [lower, upper]

  // Remove from upper row first (up to 50%), then lower row (up to 30%)
  const maxUpperRemove = Math.floor(cols * UPPER_REMOVAL_RATIO);
  const maxLowerRemove = Math.floor(cols * LOWER_REMOVAL_RATIO);
  const removed = [];

  // Phase 1: upper row removals
  const upperToRemove = maxUpperRemove > 0 ? rng.int(0, maxUpperRemove) : 0;
  for (let r = 0; r < upperToRemove; r++) {
    if (r === 0) {
      // First removal: random column, upper row
      const col = rng.int(0, cols - 1);
      grid[col][1] = false;
      removed.push({ col, row: 1 });
    } else {
      // Adjacent to a previously removed upper quad
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

  // Phase 2: lower row removals — only adjacent to already-removed quads
  const lowerToRemove = maxLowerRemove > 0 ? rng.int(0, maxLowerRemove) : 0;
  for (let r = 0; r < lowerToRemove; r++) {
    // Find lower-row candidates adjacent to any removed quad
    const candidates = [];
    for (const prev of removed) {
      // Below an upper removal
      if (prev.row === 1 && grid[prev.col][0]) {
        candidates.push(prev.col);
      }
      // Beside a lower removal
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

  // Convert remaining quadrants to wall segments
  const segments = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (!grid[col][row]) continue;

      const segBaseY = baseY + row * quadH;
      const offset = col * quadW;
      const segX = axis === 'x' ? wallX + offset : wallX;
      const segZ = axis === 'z' ? wallZ + offset : wallZ;

      segments.push({
        x: segX,
        z: segZ,
        length: quadW,
        height: quadH,
        baseY: segBaseY,
        thickness,
        axis,
      });
    }
  }

  // Merge adjacent segments with same height and baseY
  return mergeSegments(segments);
}

/**
 * Merge adjacent segments along the same axis with matching height and baseY.
 */
function mergeSegments(segments) {
  if (segments.length <= 1) return segments;

  // Group by row (baseY)
  const byRow = new Map();
  for (const s of segments) {
    const key = s.baseY.toFixed(2);
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(s);
  }

  const merged = [];
  for (const [, rowSegs] of byRow) {
    // Sort by position along axis
    rowSegs.sort((a, b) => {
      const posA = a.axis === 'x' ? a.x : a.z;
      const posB = b.axis === 'x' ? b.x : b.z;
      return posA - posB;
    });

    let current = { ...rowSegs[0] };
    for (let i = 1; i < rowSegs.length; i++) {
      const next = rowSegs[i];
      const currEnd = current.axis === 'x' ? current.x + current.length : current.z + current.length;
      const nextStart = next.axis === 'x' ? next.x : next.z;

      if (Math.abs(currEnd - nextStart) < 0.01 &&
          Math.abs(current.height - next.height) < 0.01 &&
          Math.abs(current.baseY - next.baseY) < 0.01) {
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
