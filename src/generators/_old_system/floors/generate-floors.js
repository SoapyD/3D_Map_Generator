/**
 * Stage 3: Floor Plate Generation — Quadrant System
 *
 * Each building floor is divided into 4 quadrants:
 *   0 | 1      (x0,z0)-(xMid,zMid) | (xMid,z0)-(x1,zMid)
 *   -----
 *   2 | 3      (x0,zMid)-(xMid,z1) | (xMid,zMid)-(x1,z1)
 *
 * Removal tiers (applied per floor, bottom-up):
 *   tier 0: no quadrants removed
 *   tier 1: 1 random quadrant removed (only if none removed yet)
 *   tier 2: 1 adjacent quadrant removed (only if 1 already removed)
 *   tier 3: 1 adjacent quadrant removed (only if 2 already removed)
 *
 * Each floor inherits the removed set from below, then may escalate.
 * Max 2 floors at removal tier 0.
 */

import { processBuildingFloors } from './process-building-floors.js';

export function generateFloors(data, config, rng) {
  const floors = [];

  // Tier 0: base plane
  floors.push({
    tier: 0,
    sections: [{ x: 0, z: 0, w: config.mapWidth, d: config.mapDepth }],
  });

  for (let t = 1; t <= config.tiers; t++) {
    floors.push({ tier: t, sections: [] });
  }

  const buildingQuadrants = [];
  const roofs = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const { bq, tierSections, roofs: buildingRoofs } = processBuildingFloors(building, bi, data, config, rng);

    for (const { tier, sections } of tierSections) {
      for (const s of sections) floors[tier].sections.push(s);
    }

    buildingQuadrants.push(bq);
    roofs.push(...buildingRoofs);
  }

  return { ...data, floors, buildingQuadrants, roofs };
}
