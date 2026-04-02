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

import { FLOOR, BUILDING } from '../config.js';
import { pickAdjacentToRemoved } from './pick-adjacent-to-removed.js';
import { quadrantsToSections } from './quadrants-to-sections.js';

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
  const roofs = []; // { type: 'flat'|'pyramid', tier, sections, buildingIndex, building }

  for (const building of data.buildings) {
    const bq = { tiers: {} };
    const removed = new Set();
    let tier0Count = 0;
    const isTower = building.size === 'tower';

    // Pre-remove quadrants based on building shape
    if (building.shape && BUILDING.smallShapes && BUILDING.smallShapes[building.shape]) {
      for (const q of BUILDING.smallShapes[building.shape].removed) {
        removed.add(q);
      }
    }

    const hasShape = building.shape && BUILDING.smallShapes && BUILDING.smallShapes[building.shape] && BUILDING.smallShapes[building.shape].removed.length > 0;
    for (let tier = 1; tier <= building.maxTier; tier++) {
      // Tier 1 is protected when building has a non-full shape — the shape IS the tier 1 footprint
      if (hasShape && tier === 1) {
        const present = new Set([0, 1, 2, 3].filter((q) => !removed.has(q)));
        bq.tiers[tier] = present;
        const sections = quadrantsToSections(building, present);
        const isRoofTier = tier === building.maxTier;
        if (isRoofTier && building.pyramidRoof) {
          roofs.push({ type: 'pyramid', tier, building, buildingIndex: data.buildings.indexOf(building) });
        } else if (isRoofTier) {
          for (const s of sections) roofs.push({ type: 'flat', tier, section: s, buildingIndex: data.buildings.indexOf(building) });
        } else {
          for (const s of sections) floors[tier].sections.push(s);
        }
        continue;
      }

      const removalCount = removed.size;

      if (removalCount === 0) {
        // Currently at removal tier 0
        tier0Count++;
        if (!isTower && (tier0Count > FLOOR.maxTier0Floors || (tier > 1 && rng.chance(FLOOR.tier1EscalateChance)))) {
          // Escalate to removal tier 1: remove 1 random quadrant
          const available = [0, 1, 2, 3].filter((q) => !removed.has(q));
          removed.add(rng.pick(available));
        }
      } else if (removalCount === 1) {
        // Currently at removal tier 1, may escalate to tier 2
        if (rng.chance(FLOOR.tier2EscalateChance)) {
          const adj = pickAdjacentToRemoved(removed, rng);
          if (adj !== null) removed.add(adj);
        }
      } else if (removalCount === 2) {
        // Currently at removal tier 2, may escalate to tier 3
        if (rng.chance(FLOOR.tier3EscalateChance)) {
          const adj = pickAdjacentToRemoved(removed, rng);
          if (adj !== null) removed.add(adj);
        }
      }

      const present = new Set([0, 1, 2, 3].filter((q) => !removed.has(q)));
      bq.tiers[tier] = present;

      // Convert to sections
      const sections = quadrantsToSections(building, present);
      const isRoofTier = tier === building.maxTier;

      if (isRoofTier && building.pyramidRoof) {
        // Pyramid roof replaces the flat roof — no floor sections at this tier
        roofs.push({
          type: 'pyramid',
          tier,
          building,
          buildingIndex: data.buildings.indexOf(building),
        });
      } else if (isRoofTier) {
        // Flat roof — sections go to roofs array, not floors
        for (const s of sections) {
          roofs.push({
            type: 'flat',
            tier,
            section: s,
            buildingIndex: data.buildings.indexOf(building),
          });
        }
      } else {
        for (const s of sections) {
          floors[tier].sections.push(s);
        }
      }
    }

    buildingQuadrants.push(bq);
  }

  return { ...data, floors, buildingQuadrants, roofs };
}

