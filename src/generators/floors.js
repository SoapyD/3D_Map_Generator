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

import { FLOOR } from '../config.js';

const ADJACENT = {
  0: [1, 2],
  1: [0, 3],
  2: [0, 3],
  3: [1, 2],
};

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

  for (const building of data.buildings) {
    const bq = { tiers: {} };
    const removed = new Set();
    let tier0Count = 0;

    for (let tier = 1; tier <= building.maxTier; tier++) {
      const removalCount = removed.size;

      if (removalCount === 0) {
        // Currently at removal tier 0
        tier0Count++;
        if (tier0Count > FLOOR.maxTier0Floors || (tier > 1 && rng.chance(FLOOR.tier1EscalateChance))) {
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
      for (const s of sections) {
        floors[tier].sections.push(s);
      }
    }

    buildingQuadrants.push(bq);
  }

  return { ...data, floors, buildingQuadrants };
}

function pickAdjacentToRemoved(removed, rng) {
  const candidates = new Set();
  for (const r of removed) {
    for (const adj of ADJACENT[r]) {
      if (!removed.has(adj)) candidates.add(adj);
    }
  }
  if (candidates.size === 0) return null;
  return rng.pick([...candidates]);
}

function quadrantsToSections(building, present) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;

  const quads = {
    0: { x: building.x, z: building.z, w: building.w / 2, d: building.d / 2 },
    1: { x: mx, z: building.z, w: building.w / 2, d: building.d / 2 },
    2: { x: building.x, z: mz, w: building.w / 2, d: building.d / 2 },
    3: { x: mx, z: mz, w: building.w / 2, d: building.d / 2 },
  };

  const sections = [];
  const used = new Set();

  // Merge adjacent quadrants into larger rects where possible
  // Top row
  if (present.has(0) && present.has(1)) {
    sections.push({ x: building.x, z: building.z, w: building.w, d: building.d / 2 });
    used.add(0); used.add(1);
  }
  // Bottom row
  if (present.has(2) && present.has(3)) {
    sections.push({ x: building.x, z: mz, w: building.w, d: building.d / 2 });
    used.add(2); used.add(3);
  }
  // Left col
  if (present.has(0) && present.has(2) && !used.has(0) && !used.has(2)) {
    sections.push({ x: building.x, z: building.z, w: building.w / 2, d: building.d });
    used.add(0); used.add(2);
  }
  // Right col
  if (present.has(1) && present.has(3) && !used.has(1) && !used.has(3)) {
    sections.push({ x: mx, z: building.z, w: building.w / 2, d: building.d });
    used.add(1); used.add(3);
  }

  // Remaining singles
  for (const q of present) {
    if (!used.has(q)) sections.push(quads[q]);
  }

  return sections;
}
