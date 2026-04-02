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
import { applyWallDamage } from './apply-wall-damage.js';
import { buildWall } from './build/buildWall.js';
import { pickInteriorVariant } from './pick/pickInteriorVariant.js';

const QUADRANT_EDGES = {
  0: ['north', 'west'],
  1: ['north', 'east'],
  2: ['south', 'west'],
  3: ['south', 'east'],
};

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
