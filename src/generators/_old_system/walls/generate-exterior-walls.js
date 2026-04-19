import { applyWallDamage } from './apply-wall-damage.js';
import { buildWall } from './buildWall.js';

const QUADRANT_EDGES = {
  0: ['north', 'west'],
  1: ['north', 'east'],
  2: ['south', 'west'],
  3: ['south', 'east'],
};

export function generateExteriorWalls(data, config, rng) {
  const { tierHeight, wallThickness, slabThickness } = config;
  const walls = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];

    for (let tier = 0; tier < building.maxTier; tier++) {
      const baseY = tier * tierHeight + slabThickness;
      const wallHeight = tierHeight - slabThickness;
      const aboveTier = tier + 1;
      const aboveQuadrants = bq.tiers[aboveTier];
      if (!aboveQuadrants || aboveQuadrants.size === 0) continue;

      const edgeSet = new Set();
      for (const q of aboveQuadrants) {
        for (const edge of QUADRANT_EDGES[q]) edgeSet.add(edge);
      }

      const hasShape = building.shape && building.shape !== 'full';
      const allEdges = rng.shuffle([...edgeSet]);
      const chosen = hasShape ? allEdges : allEdges.slice(0, 2);

      for (const edgeLabel of chosen) {
        if (building.suppressEdges) {
          let suppressed = false;
          for (const se of building.suppressEdges) {
            if (se.edge === edgeLabel && !se.zMin && !se.xMin) suppressed = true;
          }
          if (suppressed) continue;
        }

        const wallDef = buildWall(building, edgeLabel, aboveQuadrants, baseY, wallHeight, wallThickness);
        if (!wallDef) continue;

        const segments = applyWallDamage(wallDef, rng, 'external');

        if (building.suppressEdges) {
          for (const se of building.suppressEdges) {
            if (se.edge !== edgeLabel) continue;
            if (se.zMin !== undefined) {
              for (let si = segments.length - 1; si >= 0; si--) {
                const s = segments[si];
                const sz1 = s.axis === 'z' ? s.z + s.length : s.z + s.thickness;
                if (s.z < se.zMax + 0.1 && sz1 > se.zMin - 0.1) segments.splice(si, 1);
              }
            }
            if (se.xMin !== undefined) {
              for (let si = segments.length - 1; si >= 0; si--) {
                const s = segments[si];
                const sx1 = s.axis === 'x' ? s.x + s.length : s.x + s.thickness;
                if (s.x < se.xMax + 0.1 && sx1 > se.xMin - 0.1) segments.splice(si, 1);
              }
            }
          }
        }

        walls.push(...segments);
      }
    }
  }

  return walls;
}
