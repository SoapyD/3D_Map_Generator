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

import { WALL } from '../config.js';

const WALL_QUAD_SIZE = WALL.quadSize;
const UPPER_REMOVAL_RATIO = WALL.upperRemovalRatio;
const LOWER_REMOVAL_RATIO = WALL.lowerRemovalRatio;

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

      // Diagonal/shaped buildings use all edges; full rectangles pick up to 2
      const hasShape = building.shape && building.shape !== 'full';
      const allEdges = rng.shuffle([...edgeSet]);
      const chosen = hasShape ? allEdges : allEdges.slice(0, 2);

      for (const edgeLabel of chosen) {
        // Skip suppressed edges
        if (building.suppressEdges) {
          let suppressed = false;
          for (const se of building.suppressEdges) {
            if (se.edge === edgeLabel) {
              if (!se.zMin && !se.xMin) {
                // Full edge suppressed
                suppressed = true;
              }
              // Partial suppression handled below after wall generation
            }
          }
          if (suppressed) continue;
        }

        const wallDef = buildWall(building, edgeLabel, aboveQuadrants, baseY, wallHeight, wallThickness);
        if (!wallDef) continue;

        // Apply wall quadrant damage
        const segments = applyWallDamage(wallDef, rng);

        // Filter out segments that fall in partially suppressed zones
        if (building.suppressEdges) {
          for (const se of building.suppressEdges) {
            if (se.edge !== edgeLabel) continue;
            if (se.zMin !== undefined) {
              // Remove segments whose Z range overlaps the suppressed zone (east/west edges)
              for (let si = segments.length - 1; si >= 0; si--) {
                const s = segments[si];
                const sz1 = s.axis === 'z' ? s.z + s.length : s.z + s.thickness;
                if (s.z < se.zMax + 0.1 && sz1 > se.zMin - 0.1) {
                  segments.splice(si, 1);
                }
              }
            }
            if (se.xMin !== undefined) {
              // Remove segments whose X range overlaps the suppressed zone (north/south edges)
              for (let si = segments.length - 1; si >= 0; si--) {
                const s = segments[si];
                const sx1 = s.axis === 'x' ? s.x + s.length : s.x + s.thickness;
                if (s.x < se.xMax + 0.1 && sx1 > se.xMin - 0.1) {
                  segments.splice(si, 1);
                }
              }
            }
          }
        }

        walls.push(...segments);
      }
    }
  }

  // Interior walls for medium/large buildings on mid-floors
  const interiorWalls = [];
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    if (building.size !== 'medium' && building.size !== 'large') continue;
    const bq = data.buildingQuadrants[bi];
    const forceInterior = building.interiorWalls === true;
    if (building.interiorWalls === false) continue;
    const chance = forceInterior ? 1.0 : (WALL.interiorWallChance[building.size] || 0);

    for (let tier = 1; tier < building.maxTier; tier++) {
      if (!rng.chance(chance)) continue;

      const aboveQuadrants = bq.tiers[tier + 1];
      if (!aboveQuadrants || aboveQuadrants.size < 2) continue;

      const baseY = tier * tierHeight + slabThickness;
      const wallHeight = tierHeight - slabThickness;
      const { x, z, w, d } = building;
      const mx = x + w / 2;
      const mz = z + d / 2;

      // Pick a variant
      const variant = pickInteriorVariant(rng);

      const defs = [];
      if (variant === 'cross') {
        // N-S wall through centre (half room length, centred)
        defs.push({ x: mx - wallThickness / 2, z: z + d / 4, length: d / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
        // E-W wall through centre (half room width, centred)
        defs.push({ x: x + w / 4, z: mz - wallThickness / 2, length: w / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      } else if (variant === 'centreNS') {
        // Wall from north edge midpoint toward centre
        defs.push({ x: mx - wallThickness / 2, z, length: d / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
      } else if (variant === 'centreSN') {
        // Wall from south edge midpoint toward centre
        defs.push({ x: mx - wallThickness / 2, z: mz, length: d / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
      } else if (variant === 'centreEW') {
        // Wall from west edge midpoint toward centre
        defs.push({ x, z: mz - wallThickness / 2, length: w / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      } else if (variant === 'centreWE') {
        // Wall from east edge midpoint toward centre
        defs.push({ x: mx, z: mz - wallThickness / 2, length: w / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      }

      for (const def of defs) {
        const segments = applyWallDamage(def, rng);
        interiorWalls.push(...segments);
      }
    }
  }

  walls.push(...interiorWalls);

  return { ...data, walls };
}

function pickInteriorVariant(rng) {
  const variants = WALL.interiorWallVariants;
  if (!variants) return 'centreNS';
  const entries = Object.entries(variants);
  const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
  const roll = rng.random() * totalWeight;
  let cumulative = 0;
  for (const [name, v] of entries) {
    cumulative += v.weight;
    if (roll < cumulative) return name;
  }
  return entries[0][0];
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

/**
 * Get the position, length, height and baseY for a wall on a given edge.
 */
function buildWall(building, edgeLabel, present, baseY, wallHeight, thickness) {
  const { x, z, w, d } = building;
  const mx = x + w / 2;
  const mz = z + d / 2;

  switch (edgeLabel) {
    case 'north': {
      const has0 = present.has(0);
      const has1 = present.has(1);
      if (!has0 && !has1) return null;
      return { x: has0 ? x : mx, z: z, length: (has0 && has1) ? w : w / 2, height: wallHeight, baseY, thickness, axis: 'x' };
    }
    case 'south': {
      const has2 = present.has(2);
      const has3 = present.has(3);
      if (!has2 && !has3) return null;
      return { x: has2 ? x : mx, z: z + d - thickness, length: (has2 && has3) ? w : w / 2, height: wallHeight, baseY, thickness, axis: 'x' };
    }
    case 'west': {
      const has0 = present.has(0);
      const has2 = present.has(2);
      if (!has0 && !has2) return null;
      return { x: x, z: has0 ? z : mz, length: (has0 && has2) ? d : d / 2, height: wallHeight, baseY, thickness, axis: 'z' };
    }
    case 'east': {
      const has1 = present.has(1);
      const has3 = present.has(3);
      if (!has1 && !has3) return null;
      return { x: x + w - thickness, z: has1 ? z : mz, length: (has1 && has3) ? d : d / 2, height: wallHeight, baseY, thickness, axis: 'z' };
    }
  }
  return null;
}
