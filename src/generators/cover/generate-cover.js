/**
 * Stage 6: Cover Placement
 *
 * Places small cover boxes on:
 * - Building rooftops (highest tier, on each non-deleted floor quadrant)
 * - Ground level (in the footprints of deleted buildings, 1-3 per area)
 * - Street scatter (random placement across the ground floor)
 *
 * Two types:
 * - Wide: 1.5" wide × 0.75-1.5" tall × random depth (2-4")
 * - Long: random width (2-4") × 0.75-1.5" tall × 1.5" deep
 */

import { COVER, DELETIONS } from '../../config.js';
import { hitsAnyWall } from './cover-hits-wall.js';
import { generateRooftopCover } from './generate-rooftop-cover.js';
import { generateInteriorCover } from './generate-interior-cover.js';
import { generateGroundAndStreetCover } from './generate-ground-cover.js';

export function generateCover(data, config, rng) {
  const { slabThickness } = config;
  const cover = generateRooftopCover(data, config, rng);
  const interiorCover = generateInteriorCover(data, config, rng, cover);

  // Generate courtyard footprints first, cull, then place cover only on survivors
  const deleted = data.deletedBuildings || [];
  const expansion = COVER.courtyardExpansion;
  let deletedFootprints = deleted.map((db, i) => ({
    x: db.x - expansion, z: db.z - expansion, w: db.w + expansion * 2, d: db.d + expansion * 2, index: i,
  }));
  if (DELETIONS.courtyardWallCull) {
    deletedFootprints = deletedFootprints.filter((fp) => !hitsAnyWall(fp, data.walls));
  }

  const allLadders = [
    ...(data.connections?.ladders || []),
    ...(data.connections?.groundLadders || []),
    ...(data.connections?.orangeLadders || []),
    ...(data.connections?.interiorLadders || []),
  ];

  const { groundCover, streetScatter } = generateGroundAndStreetCover(data, config, rng, cover, allLadders, deletedFootprints);
  cover.push(...groundCover);

  // Remove ground-level cover that intersects visible building walls
  const filteredCover = cover.filter((c) => {
    if (c.y > slabThickness + 0.1) return true;
    return !hitsAnyWall(c, data.walls);
  });

  return { ...data, cover: filteredCover, interiorCover, deletedFootprints, streetScatter };
}
