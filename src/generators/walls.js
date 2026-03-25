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
        const wall = buildWall(building, edgeLabel, aboveQuadrants, baseY, wallHeight, wallThickness);
        if (wall) walls.push(wall);
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
