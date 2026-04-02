/**
 * Generate walkways connecting buildings at the same tier.
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { walkwaysIntersect } from './walkways-intersect.js';
import { getQuadrantRect } from './get-quadrant-rect.js';
import { findBuildingIndex } from './find-building-index.js';

const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

/**
 * Generate walkways connecting buildings at the same tier.
 * @param {object} ctx - { data, config, rng }
 * @returns {object} { culledWalkways }
 */
export function generateWalkways(ctx) {
  const { data, config, rng } = ctx;
  const { tierHeight, slabThickness } = config;
  const walkways = [];

  // For each building, each tier, each floor quadrant:
  // try to connect quadrant centre to nearest floor on another building.
  // Drop if it hits a wall.
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];

    for (let tier = 1; tier <= building.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      const y = tier * tierHeight;
      const mx = building.x + building.w / 2;
      const mz = building.z + building.d / 2;

      const floorData = data.floors.find((f) => f.tier === tier);
      if (!floorData) continue;

      for (const q of present) {
        const srcRect = getQuadrantRect(building, q);

        // Only external edges — skip edges shared with another present quadrant
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
          // Find nearest floor section in a different building to this edge point
          let bestSection = null;
          let bestDist = Infinity;

          for (const section of floorData.sections) {
            const sbi = findBuildingIndex(section, data.buildings);
            if (sbi === bi) continue;

            // Distance from edge midpoint to nearest point on target section
            const nearX = Math.max(section.x, Math.min(edge.x, section.x + section.w));
            const nearZ = Math.max(section.z, Math.min(edge.z, section.z + section.d));
            const dist = Math.sqrt((edge.x - nearX) ** 2 + (edge.z - nearZ) ** 2);

            if (dist < bestDist) {
              bestDist = dist;
              bestSection = section;
            }
          }

          if (!bestSection || bestDist > 20) continue;

          const tgtRect = bestSection;

          // Build walkway from source edge midpoint to nearest point on target edge
          // Target must be in the direction this edge faces
          const tgtCx = tgtRect.x + tgtRect.w / 2;
          const tgtCz = tgtRect.z + tgtRect.d / 2;
          if (edge.side === 'east' && tgtCx < srcRect.x + srcRect.w) continue;
          if (edge.side === 'west' && tgtCx > srcRect.x) continue;
          if (edge.side === 'south' && tgtCz < srcRect.z + srcRect.d) continue;
          if (edge.side === 'north' && tgtCz > srcRect.z) continue;

          let walkway;

          if (edge.side === 'east' || edge.side === 'west') {
            // Walkway runs along X
            const gs = edge.side === 'east' ? srcRect.x + srcRect.w : tgtRect.x + tgtRect.w;
            const ge = edge.side === 'east' ? tgtRect.x : srcRect.x;
            if (ge <= gs) continue; // target overlaps or is behind us
            const len = ge - gs;
            if (len < CONNECTIVITY.minWalkwayLength || len > CONNECTIVITY.maxWalkwayLength) continue;

            // Z position: middle of source edge, clamped to target's Z range
            const clampedZ = Math.max(tgtRect.z + WALKWAY_WIDTH / 2, Math.min(edge.z, tgtRect.z + tgtRect.d - WALKWAY_WIDTH / 2));
            walkway = { type: 'walkway', x: gs, z: clampedZ - WALKWAY_WIDTH / 2, w: len, d: WALKWAY_WIDTH, y, axis: 'x' };
          } else {
            // Walkway runs along Z
            const gs = edge.side === 'south' ? srcRect.z + srcRect.d : tgtRect.z + tgtRect.d;
            const ge = edge.side === 'south' ? tgtRect.z : srcRect.z;
            if (ge <= gs) continue;
            const len = ge - gs;
            if (len < CONNECTIVITY.minWalkwayLength || len > CONNECTIVITY.maxWalkwayLength) continue;

            // X position: middle of source edge, clamped to target's X range
            const clampedX = Math.max(tgtRect.x + WALKWAY_WIDTH / 2, Math.min(edge.x, tgtRect.x + tgtRect.w - WALKWAY_WIDTH / 2));
            walkway = { type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: gs, w: WALKWAY_WIDTH, d: len, y, axis: 'z' };
          }

          // Check against walls on this exact floor level only
          // Wall baseY for this tier's walls = tier * tierHeight + slabThickness
          const wallTierY = tier * tierHeight + slabThickness;
          const margin = 0.3;
          let hitsWall = false;
          for (const wall of data.walls) {
            if (Math.abs(wall.baseY - wallTierY) > 0.5) continue;
            const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
            const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
            if (walkway.x < wallX1 + margin && walkway.x + walkway.w > wall.x - margin &&
                walkway.z < wallZ1 + margin && walkway.z + walkway.d > wall.z - margin) {
              hitsWall = true;
              break;
            }
          }
          if (DELETIONS.walkwayWallCollision && hitsWall) {
            walkway.blocked = true;
          }

          // Verify both ends touch a floor section at this tier
          let startTouches = false, endTouches = false;
          for (const s of floorData.sections) {
            if (walkway.axis === 'x') {
              if (Math.abs(s.x + s.w - walkway.x) < 0.5 && walkway.z + walkway.d > s.z && walkway.z < s.z + s.d) startTouches = true;
              if (Math.abs(s.x - (walkway.x + walkway.w)) < 0.5 && walkway.z + walkway.d > s.z && walkway.z < s.z + s.d) endTouches = true;
            } else {
              if (Math.abs(s.z + s.d - walkway.z) < 0.5 && walkway.x + walkway.w > s.x && walkway.x < s.x + s.w) startTouches = true;
              if (Math.abs(s.z - (walkway.z + walkway.d)) < 0.5 && walkway.x + walkway.w > s.x && walkway.x < s.x + s.w) endTouches = true;
            }
          }
          if (DELETIONS.walkwayBothEndsCheck && (!startTouches || !endTouches)) continue;

          // Reject walkways that overhang — cross-axis overlap with floor must be ≥50% of walkway width
          let startOverlap = 0, endOverlap = 0;
          const wSpan = walkway.axis === 'x' ? walkway.d : walkway.w;
          for (const s of floorData.sections) {
            if (walkway.axis === 'x') {
              // Start end: floor edge flush with walkway.x
              if (Math.abs(s.x + s.w - walkway.x) < 0.5) {
                const ov = Math.min(walkway.z + walkway.d, s.z + s.d) - Math.max(walkway.z, s.z);
                if (ov > startOverlap) startOverlap = ov;
              }
              // End end: floor edge flush with walkway.x + walkway.w
              if (Math.abs(s.x - (walkway.x + walkway.w)) < 0.5) {
                const ov = Math.min(walkway.z + walkway.d, s.z + s.d) - Math.max(walkway.z, s.z);
                if (ov > endOverlap) endOverlap = ov;
              }
            } else {
              if (Math.abs(s.z + s.d - walkway.z) < 0.5) {
                const ov = Math.min(walkway.x + walkway.w, s.x + s.w) - Math.max(walkway.x, s.x);
                if (ov > startOverlap) startOverlap = ov;
              }
              if (Math.abs(s.z - (walkway.z + walkway.d)) < 0.5) {
                const ov = Math.min(walkway.x + walkway.w, s.x + s.w) - Math.max(walkway.x, s.x);
                if (ov > endOverlap) endOverlap = ov;
              }
            }
          }
          if (startOverlap / wSpan < 0.5 || endOverlap / wSpan < 0.5) continue;

          // Prevent stacking — reject if an existing walkway on a different tier
          // runs the same axis and overlaps in XZ position
          let stacked = false;
          for (const existing of walkways) {
            if (existing.axis !== walkway.axis) continue;
            if (Math.abs(existing.y - walkway.y) < 0.5) continue; // same tier is fine
            // Check XZ overlap
            if (walkway.x < existing.x + existing.w && walkway.x + walkway.w > existing.x &&
                walkway.z < existing.z + existing.d && walkway.z + walkway.d > existing.z) {
              stacked = true;
              break;
            }
          }
          if (stacked) continue;

          walkways.push(walkway);
        }
      }
    }
  }

  // Strip intersecting walkways: loop through, if current walkway intersects
  // another, mark the other for dropping. Skip intersection checks against
  // walkways already marked for dropping.
  let filteredWalkways;
  if (DELETIONS.walkwayIntersectionStrip) {
    const toDrop = new Set();
    for (let i = 0; i < walkways.length; i++) {
      if (toDrop.has(i)) continue;
      for (let j = i + 1; j < walkways.length; j++) {
        if (toDrop.has(j)) continue;
        if (walkwaysIntersect(walkways[i], walkways[j])) {
          toDrop.add(j);
        }
      }
    }
    filteredWalkways = walkways.filter((_, i) => !toDrop.has(i));
  } else {
    filteredWalkways = walkways;
  }

  // Keep ratio cull per tier
  let culledWalkways;
  if (DELETIONS.walkwayKeepRatioCull) {
    const byTier = new Map();
    for (const w of filteredWalkways) {
      const t = Math.round(w.y / tierHeight);
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t).push(w);
    }
    culledWalkways = [];
    for (const [, tierWalkways] of byTier) {
      rng.shuffle(tierWalkways);
      const keep = Math.max(1, Math.ceil(tierWalkways.length * CONNECTIVITY.walkwayKeepRatio));
      culledWalkways.push(...tierWalkways.slice(0, keep));
    }
  } else {
    culledWalkways = filteredWalkways;
  }

  return { culledWalkways };
}
