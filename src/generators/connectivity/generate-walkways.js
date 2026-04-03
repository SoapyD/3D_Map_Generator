/**
 * Generate walkways connecting buildings at the same tier.
 */

import { CONNECTIVITY } from '../../config.js';
import { getQuadrantRect } from './get-quadrant-rect.js';
import { findNearestSection } from './find-nearest-section.js';
import { buildWalkwayRect } from './build-walkway-rect.js';
import { validateWalkway } from './validate-walkway.js';
import { stripIntersectingWalkways } from './strip-intersecting-walkways.js';
import { cullWalkwaysByTier } from './cull-walkways-by-tier.js';

const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

/**
 * Generate walkways connecting buildings at the same tier.
 * @param {object} ctx - { data, config, rng }
 * @returns {object} { culledWalkways }
 */
export function generateWalkways(ctx) {
  const { data, config, rng } = ctx;
  const { tierHeight } = config;
  const walkways = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];

    for (let tier = 1; tier <= building.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      const y = tier * tierHeight;
      const floorData = data.floors.find((f) => f.tier === tier);
      if (!floorData) continue;

      for (const q of present) {
        const srcRect = getQuadrantRect(building, q);

        const neighborN = (q === 2) ? 0 : (q === 3) ? 1 : -1;
        const neighborS = (q === 0) ? 2 : (q === 1) ? 3 : -1;
        const neighborW = (q === 1) ? 0 : (q === 3) ? 2 : -1;
        const neighborE = (q === 0) ? 1 : (q === 2) ? 3 : -1;

        const edges = [];
        if (neighborN < 0 || !present.has(neighborN))
          edges.push({ side: 'north', x: srcRect.x + srcRect.w / 2, z: srcRect.z });
        if (neighborS < 0 || !present.has(neighborS))
          edges.push({ side: 'south', x: srcRect.x + srcRect.w / 2, z: srcRect.z + srcRect.d });
        if (neighborW < 0 || !present.has(neighborW))
          edges.push({ side: 'west', x: srcRect.x, z: srcRect.z + srcRect.d / 2 });
        if (neighborE < 0 || !present.has(neighborE))
          edges.push({ side: 'east', x: srcRect.x + srcRect.w, z: srcRect.z + srcRect.d / 2 });

        for (const edge of edges) {
          const { bestSection, bestDist } = findNearestSection(edge, bi, floorData, data.buildings);
          if (!bestSection || bestDist > 20) continue;

          const walkway = buildWalkwayRect(edge, srcRect, bestSection, y, WALKWAY_WIDTH);
          if (!walkway) continue;

          const result = validateWalkway(walkway, tier, data, config, walkways);
          if (!result.valid) continue;
          if (result.blocked) walkway.blocked = true;

          walkways.push(walkway);
        }
      }
    }
  }

  const filteredWalkways = stripIntersectingWalkways(walkways);
  const culledWalkways = cullWalkwaysByTier(filteredWalkways, rng, tierHeight);

  return { culledWalkways };
}
