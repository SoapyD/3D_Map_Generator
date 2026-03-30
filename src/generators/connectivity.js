/**
 * Stage 5: Connectivity
 *
 * Ensures all elevated floor sections are reachable from ground level.
 * Three connection types:
 *   - Ladders: vertical, within a building (connects tier N to tier N+1)
 *   - Walkways: horizontal, between different buildings at the same tier
 *   - Ramps: angled, connects up to 1 tier higher (typically ground to tier 1)
 *
 * Algorithm:
 * 1. Build a graph of all floor sections as nodes
 * 2. Add edges for sections that share an edge at the same tier
 * 3. Flood-fill from tier 0 to find reachable sections
 * 4. Place ramps from ground to unreachable tier 1 sections
 * 5. Place ladders within buildings for unreachable higher tiers
 * 6. Place walkways between nearby buildings at the same tier
 * 7. Repeat flood-fill until everything is reachable
 *
 * Output: { ...data, connections: { ladders: [], walkways: [], ramps: [] } }
 */

import { CONNECTIVITY, DELETIONS, GEOMETRY } from '../config.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;
const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;
export function generateConnectivity(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const ladders = [];
  const walkways = [];

  // Tower ladder data collected here, placed after all other ladders are finalised
  const towerBuildings = data.buildings.filter(b => b.size === 'tower');

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

  // For blocked walkways, place a ladder on the side(s) that touch a wall.
  // Ladder goes up from the walkway until it reaches a tier with no wall.

  for (let wi = 0; wi < culledWalkways.length; wi++) {
    const w = culledWalkways[wi];
    if (!w.blocked) continue;

    const tier = Math.round(w.y / tierHeight);
    const wallTierY = tier * tierHeight + slabThickness;
    const margin = 0.3;

    // Check start and end of walkway for wall clash
    for (const endpoint of ['start', 'end']) {
      // Build a small test rect at the endpoint
      let testX, testZ, testW, testD;
      if (w.axis === 'x') {
        testX = endpoint === 'start' ? w.x - margin : w.x + w.w - margin;
        testZ = w.z;
        testW = margin * 2;
        testD = w.d;
      } else {
        testX = w.x;
        testZ = endpoint === 'start' ? w.z - margin : w.z + w.d - margin;
        testW = w.w;
        testD = margin * 2;
      }

      // Does this endpoint touch a wall on this tier?
      let touchesWall = false;
      for (const wall of data.walls) {
        if (Math.abs(wall.baseY - wallTierY) > 0.5) continue;
        const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        if (testX < wallX1 + margin && testX + testW > wall.x - margin &&
            testZ < wallZ1 + margin && testZ + testD > wall.z - margin) {
          touchesWall = true;
          break;
        }
      }

      if (!touchesWall) continue;

      // Place ladder flat against the wall, half walkway width, centred
      const wallOffset = 0.3;
      let ladderX, ladderZ, ladderW, ladderD;
      if (w.axis === 'x') {
        ladderX = endpoint === 'start' ? w.x - LADDER_DEPTH + wallOffset : w.x + w.w - wallOffset;
        ladderZ = w.z + w.d / 2 - LADDER_WIDTH / 2;
        ladderW = LADDER_DEPTH;
        ladderD = LADDER_WIDTH;
      } else {
        ladderX = w.x + w.w / 2 - LADDER_WIDTH / 2;
        ladderZ = endpoint === 'start' ? w.z - LADDER_DEPTH + wallOffset : w.z + w.d - wallOffset;
        ladderW = LADDER_WIDTH;
        ladderD = LADDER_DEPTH;
      }

      // Find the highest tier that still has a wall at this position
      let topTier = tier;
      for (let t = tier + 1; t <= config.tiers; t++) {
        const checkY = t * tierHeight + slabThickness;
        let hasWall = false;
        for (const wall of data.walls) {
          if (Math.abs(wall.baseY - checkY) > 0.5) continue;
          const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
          const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
          if (ladderX < wallX1 + margin && ladderX + ladderW > wall.x - margin &&
              ladderZ < wallZ1 + margin && ladderZ + ladderD > wall.z - margin) {
            hasWall = true;
            break;
          }
        }
        if (hasWall) topTier = t;
        else break;
      }

      // Trim to highest tier that has a floor near the ladder
      let ladderTopTier = topTier + 1;
      while (ladderTopTier > tier) {
        const fd = data.floors.find((f) => f.tier === ladderTopTier);
        if (fd && fd.sections.some((s) =>
          ladderX < s.x + s.w + 0.5 && ladderX + ladderW > s.x - 0.5 &&
          ladderZ < s.z + s.d + 0.5 && ladderZ + ladderD > s.z - 0.5
        )) {
          break;
        }
        ladderTopTier--;
      }

      const ladderY0 = w.y; // start at walkway level
      const ladderY1 = ladderTopTier * tierHeight;

      if (ladderY1 > ladderY0) {
        ladders.push({
          type: 'ladder',
          parentWalkway: w, // link to source walkway
          x: ladderX, z: ladderZ,
          w: ladderW, d: ladderD,
          y0: ladderY0, y1: ladderY1,
        });
      }
    }
  }

  // Ground floor ladders: for each ground floor quadrant's outward-facing edges,
  // check if there's a wall. If so, place a red ladder from ground up to the
  // first tier with no wall. Skip edges near map boundary.
  const groundLadders = [];
  const MAP_BOUNDARY_MARGIN = CONNECTIVITY.mapBoundaryMargin;

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size === 'tower') continue; // towers have their own ladder generation above
    const bq = data.buildingQuadrants[bi];
    const present = bq.tiers[1] || new Set([0, 1, 2, 3]);

    for (const q of present) {
      const qr = getQuadrantRect(b, q);

      // Only external edges — skip edges shared with another present quadrant
      // Adjacency: 0↔1 (east/west), 2↔3 (east/west), 0↔2 (south/north), 1↔3 (south/north)
      const neighborN = (q === 2) ? 0 : (q === 3) ? 1 : -1; // quadrant above
      const neighborS = (q === 0) ? 2 : (q === 1) ? 3 : -1; // quadrant below
      const neighborW = (q === 1) ? 0 : (q === 3) ? 2 : -1; // quadrant left
      const neighborE = (q === 0) ? 1 : (q === 2) ? 3 : -1; // quadrant right

      const edges = [];
      if (neighborN < 0 || !present.has(neighborN))
        edges.push({ side: 'north', x: qr.x, z: qr.z, len: qr.w, axis: 'x' });
      if (neighborS < 0 || !present.has(neighborS))
        edges.push({ side: 'south', x: qr.x, z: qr.z + qr.d, len: qr.w, axis: 'x' });
      if (neighborW < 0 || !present.has(neighborW))
        edges.push({ side: 'west', x: qr.x, z: qr.z, len: qr.d, axis: 'z' });
      if (neighborE < 0 || !present.has(neighborE))
        edges.push({ side: 'east', x: qr.x + qr.w, z: qr.z, len: qr.d, axis: 'z' });

      for (const edge of edges) {
        if (edge.side === 'north' && edge.z < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'south' && edge.z > config.mapDepth - MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'west' && edge.x < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'east' && edge.x > config.mapWidth - MAP_BOUNDARY_MARGIN) continue;

        const ladderWidth = LADDER_WIDTH;

        // Visual ladder position: centred on edge midpoint, flat against wall, offset 0.3" out
        let lx, lz, lw, ld;
        const wallOffset = 0.3;
        if (edge.axis === 'x') {
          lx = edge.x + edge.len / 2 - ladderWidth / 2;
          lz = edge.side === 'north' ? edge.z - wallOffset : edge.z - LADDER_DEPTH + wallOffset;
          lw = ladderWidth;
          ld = LADDER_DEPTH;
        } else {
          lx = edge.side === 'west' ? edge.x - wallOffset : edge.x - LADDER_DEPTH + wallOffset;
          lz = edge.z + edge.len / 2 - ladderWidth / 2;
          lw = LADDER_DEPTH;
          ld = ladderWidth;
        }

        // Check for ground wall using the VISUAL ladder position
        const groundWallY = slabThickness;
        let hasGroundWall = false;
        const margin = 0.3;
        for (const wall of data.walls) {
          if (Math.abs(wall.baseY - groundWallY) > 0.5) continue;
          const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
          const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
          if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
              lz < wallZ1 + margin && lz + ld > wall.z - margin) {
            hasGroundWall = true;
            break;
          }
        }
        if (!hasGroundWall) continue;

        // Find the highest tier where a wall overlaps the VISUAL ladder position
        let topTier = 0;
        for (let t = 1; t <= config.tiers; t++) {
          const checkY = t * tierHeight + slabThickness;
          let hasWall = false;
          for (const wall of data.walls) {
            if (Math.abs(wall.baseY - checkY) > 0.5) continue;
            const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
            const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
            if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
                lz < wallZ1 + margin && lz + ld > wall.z - margin) {
              hasWall = true;
              break;
            }
          }
          if (hasWall) topTier = t;
          else break;
        }

        // Ladder reaches the floor above the last walled tier,
        // but only if that floor actually exists near this quadrant
        // Trim to highest tier that has a floor near the ladder's visual position
        let ladderTopTier = topTier + 1;
        while (ladderTopTier > 0) {
          const floorData2 = data.floors.find((f) => f.tier === ladderTopTier);
          if (floorData2 && floorData2.sections.some((s) =>
            lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
            lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
          )) {
            break;
          }
          ladderTopTier--;
        }

        const ladderY0 = 0;
        const ladderY1 = ladderTopTier * tierHeight;

        if (ladderY1 > ladderY0) {
          groundLadders.push({
            type: 'ground_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0: ladderY0, y1: ladderY1,
          });
        }
      }
    }
  }

  // Remove ground ladders that touch any walkway
  const filteredGroundLadders = DELETIONS.redLadderWalkwayOverlap
    ? groundLadders.filter((gl) => {
        for (const w of culledWalkways) {
          if (gl.x < w.x + w.w && gl.x + gl.w > w.x &&
              gl.z < w.z + w.d && gl.z + gl.d > w.z) {
            return false;
          }
        }
        return true;
      })
    : groundLadders;

  // Orange ladders: placed on any quadrant edge, any tier except top.
  // Go up one tier. Only kept if they connect to a floor above.
  // Deleted if they touch a walkway or red ladder.
  const orangeLadders = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size === 'tower') continue; // towers have their own ladder generation
    const bq = data.buildingQuadrants[bi];

    for (let tier = 0; tier < config.tiers; tier++) {
      // Use tier 1 quadrants for ground level, otherwise the tier's quadrants
      const present = tier === 0
        ? (bq.tiers[1] || new Set([0, 1, 2, 3]))
        : bq.tiers[tier];
      if (!present) continue;

      for (const q of present) {
        const qr = getQuadrantRect(b, q);

        // External edges only
        const neighborN = (q === 2) ? 0 : (q === 3) ? 1 : -1;
        const neighborS = (q === 0) ? 2 : (q === 1) ? 3 : -1;
        const neighborW = (q === 1) ? 0 : (q === 3) ? 2 : -1;
        const neighborE = (q === 0) ? 1 : (q === 2) ? 3 : -1;

        const edges = [];
        if (neighborN < 0 || !present.has(neighborN))
          edges.push({ side: 'north', x: qr.x, z: qr.z, len: qr.w, axis: 'x' });
        if (neighborS < 0 || !present.has(neighborS))
          edges.push({ side: 'south', x: qr.x, z: qr.z + qr.d, len: qr.w, axis: 'x' });
        if (neighborW < 0 || !present.has(neighborW))
          edges.push({ side: 'west', x: qr.x, z: qr.z, len: qr.d, axis: 'z' });
        if (neighborE < 0 || !present.has(neighborE))
          edges.push({ side: 'east', x: qr.x + qr.w, z: qr.z, len: qr.d, axis: 'z' });

        for (const edge of edges) {
          // Skip edges near map boundary
          if (edge.side === 'north' && edge.z < MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'south' && edge.z > config.mapDepth - MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'west' && edge.x < MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'east' && edge.x > config.mapWidth - MAP_BOUNDARY_MARGIN) continue;

          // Spawn chance: 10% on ground floor, 20% on tier 1, 30% on tier 2+
          const spawnChance = tier === 0 ? CONNECTIVITY.orangeSpawnChance.ground : tier === 1 ? CONNECTIVITY.orangeSpawnChance.tier1 : CONNECTIVITY.orangeSpawnChance.tier2Plus;
          if (!rng.chance(spawnChance)) continue;

          // Position: centred on edge, outside building, ladder width
          const wallOffset = 0.3;
          let lx, lz, lw, ld;
          if (edge.axis === 'x') {
            lx = edge.x + edge.len / 2 - LADDER_WIDTH / 2;
            lz = edge.side === 'north' ? edge.z - wallOffset : edge.z - LADDER_DEPTH + wallOffset;
            lw = LADDER_WIDTH;
            ld = LADDER_DEPTH;
          } else {
            lx = edge.side === 'west' ? edge.x - wallOffset : edge.x - LADDER_DEPTH + wallOffset;
            lz = edge.z + edge.len / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH;
            ld = LADDER_WIDTH;
          }

          // Climb upward through multiple tiers until no floor exists
          // Use the ladder's visual position, not the source quadrant
          const y0 = tier * tierHeight;
          let topTier = tier;
          for (let t = tier + 1; t <= config.tiers; t++) {
            const floorAtT = data.floors.find((f) => f.tier === t);
            if (floorAtT && floorAtT.sections.some((s) =>
              lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
              lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
            )) {
              topTier = t;
            } else {
              break;
            }
          }

          // Must span at least 2 tiers
          if (topTier - tier < CONNECTIVITY.orangeMinSpan) continue;
          const y1 = topTier * tierHeight;

          orangeLadders.push({
            type: 'orange_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0, y1,
          });
        }
      }
    }
  }

  // Interior ladders (cyan) — climb through exposed internal quadrant edges
  // Find internal edges where the adjacent quadrant is missing above,
  // then ladder from the solid floor below up through the gap
  const interiorLadders = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];
    const mx = b.x + b.w / 2;
    const mz = b.z + b.d / 2;

    // For each tier, check internal edges for exposed gaps
    for (let tier = 2; tier <= b.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      for (const q of present) {
        const qr = getQuadrantRect(b, q);

        // Check each internal neighbor
        const neighbors = [
          { nq: (q === 0) ? 1 : (q === 2) ? 3 : -1, side: 'east', axis: 'z' },
          { nq: (q === 1) ? 0 : (q === 3) ? 2 : -1, side: 'west', axis: 'z' },
          { nq: (q === 0) ? 2 : (q === 1) ? 3 : -1, side: 'south', axis: 'x' },
          { nq: (q === 2) ? 0 : (q === 3) ? 1 : -1, side: 'north', axis: 'x' },
        ];

        for (const { nq, side, axis } of neighbors) {
          if (nq < 0) continue;
          // Only interested if neighbor is MISSING at this tier (exposed internal edge)
          if (present.has(nq)) continue;

          // Find the lowest tier where BOTH quadrants exist (solid floor below)
          let baseTier = -1;
          for (let t = tier - 1; t >= 1; t--) {
            const pAtT = bq.tiers[t];
            if (pAtT && pAtT.has(q) && pAtT.has(nq)) {
              baseTier = t;
              break;
            }
          }
          // If no solid floor found, start from ground
          if (baseTier < 0) baseTier = 0;

          // Find the highest tier where this internal edge is still exposed
          let topTier = tier;
          for (let t = tier + 1; t <= b.maxTier; t++) {
            const pAtT = bq.tiers[t];
            if (pAtT && pAtT.has(q) && !pAtT.has(nq)) {
              topTier = t;
            } else {
              break;
            }
          }

          // Must span at least 1 tier
          if (topTier <= baseTier) continue;

          // Position: on the internal edge, centred
          let lx, lz, lw, ld;
          if (side === 'east') {
            lx = qr.x + qr.w - LADDER_DEPTH / 2;
            lz = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH; ld = LADDER_WIDTH;
          } else if (side === 'west') {
            lx = qr.x - LADDER_DEPTH / 2;
            lz = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH; ld = LADDER_WIDTH;
          } else if (side === 'south') {
            lx = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
            lz = qr.z + qr.d - LADDER_DEPTH / 2;
            lw = LADDER_WIDTH; ld = LADDER_DEPTH;
          } else {
            lx = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
            lz = qr.z - LADDER_DEPTH / 2;
            lw = LADDER_WIDTH; ld = LADDER_DEPTH;
          }

          // Trim to highest tier that has a floor near the ladder
          let trimmedTop = topTier;
          while (trimmedTop > baseTier) {
            const fd = data.floors.find((f) => f.tier === trimmedTop);
            if (fd && fd.sections.some((s) =>
              lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
              lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
            )) {
              break;
            }
            trimmedTop--;
          }
          if (trimmedTop <= baseTier) continue;

          const y0 = baseTier * tierHeight;
          const y1 = trimmedTop * tierHeight;

          interiorLadders.push({
            type: 'interior_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0, y1,
          });
        }
      }
    }
  }

  // Remove orange ladders that touch any walkway or red ladder
  const filteredOrangeLadders = orangeLadders.filter((ol) => {
    if (DELETIONS.orangeLadderWalkwayOverlap) {
      for (const w of culledWalkways) {
        if (ol.x < w.x + w.w && ol.x + ol.w > w.x &&
            ol.z < w.z + w.d && ol.z + ol.d > w.z) {
          return false;
        }
      }
    }
    if (DELETIONS.orangeLadderRedOverlap) {
      for (const gl of filteredGroundLadders) {
        if (ol.x < gl.x + gl.w && ol.x + ol.w > gl.x &&
            ol.z < gl.z + gl.d && ol.z + ol.d > gl.z) {
          return false;
        }
      }
    }
    return true;
  });

  // Cull red and orange ladders to 40% each
  const culledGroundLadders = DELETIONS.redLadderCull
    ? (rng.shuffle(filteredGroundLadders), filteredGroundLadders.slice(0, Math.max(1, Math.ceil(filteredGroundLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredGroundLadders;

  const culledOrangeLadders = DELETIONS.orangeLadderCull
    ? (rng.shuffle(filteredOrangeLadders), filteredOrangeLadders.slice(0, Math.max(1, Math.ceil(filteredOrangeLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredOrangeLadders;

  // Proximity culling — only delete if same tier start point
  const PROXIMITY = CONNECTIVITY.proximity;

  // Walkways proximity
  let finalWalkways;
  if (DELETIONS.walkwayProximityCull) {
    const walkwayDropSet = new Set();
    for (let i = 0; i < culledWalkways.length; i++) {
      if (walkwayDropSet.has(i)) continue;
      for (let j = i + 1; j < culledWalkways.length; j++) {
        if (walkwayDropSet.has(j)) continue;
        if (Math.abs(culledWalkways[i].y - culledWalkways[j].y) > 0.5) continue;
        if (isClose(culledWalkways[i], culledWalkways[j], PROXIMITY)) {
          walkwayDropSet.add(j);
        }
      }
    }
    finalWalkways = culledWalkways.filter((_, i) => !walkwayDropSet.has(i));
  } else {
    finalWalkways = culledWalkways;
  }

  // Yellow ladders vs red + orange proximity
  let finalYellow;
  if (DELETIONS.yellowLadderProximityCull) {
    const allRedOrange = [...culledGroundLadders, ...culledOrangeLadders];
    const yellowDropSet = new Set();
    for (let i = 0; i < ladders.length; i++) {
      if (yellowDropSet.has(i)) continue;
      for (const other of allRedOrange) {
        if (Math.abs(ladders[i].y0 - other.y0) > 0.5) continue;
        if (isClose(ladders[i], other, PROXIMITY)) {
          yellowDropSet.add(i);
          break;
        }
      }
    }
    finalYellow = ladders.filter((_, i) => !yellowDropSet.has(i));
  } else {
    finalYellow = ladders;
  }

  // Red ladders vs red + orange proximity
  let finalRed;
  if (DELETIONS.redLadderProximityCull) {
    const redDropSet = new Set();
    for (let i = 0; i < culledGroundLadders.length; i++) {
      if (redDropSet.has(i)) continue;
      for (let j = i + 1; j < culledGroundLadders.length; j++) {
        if (redDropSet.has(j)) continue;
        if (Math.abs(culledGroundLadders[i].y0 - culledGroundLadders[j].y0) > 0.5) continue;
        if (isClose(culledGroundLadders[i], culledGroundLadders[j], PROXIMITY)) {
          redDropSet.add(j);
        }
      }
      for (const ol of culledOrangeLadders) {
        if (Math.abs(culledGroundLadders[i].y0 - ol.y0) > 0.5) continue;
        if (isClose(culledGroundLadders[i], ol, PROXIMITY)) {
          redDropSet.add(i);
          break;
        }
      }
    }
    finalRed = culledGroundLadders.filter((_, i) => !redDropSet.has(i));
  } else {
    finalRed = culledGroundLadders;
  }

  // Orange ladders vs other orange proximity
  let finalOrange;
  if (DELETIONS.orangeLadderProximityCull) {
    const orangeDropSet = new Set();
    for (let i = 0; i < culledOrangeLadders.length; i++) {
      if (orangeDropSet.has(i)) continue;
      for (let j = i + 1; j < culledOrangeLadders.length; j++) {
        if (orangeDropSet.has(j)) continue;
        if (Math.abs(culledOrangeLadders[i].y0 - culledOrangeLadders[j].y0) > 0.5) continue;
        if (isClose(culledOrangeLadders[i], culledOrangeLadders[j], PROXIMITY)) {
          orangeDropSet.add(j);
        }
      }
    }
    finalOrange = culledOrangeLadders.filter((_, i) => !orangeDropSet.has(i));
  } else {
    finalOrange = culledOrangeLadders;
  }

  // Post-process: flag orange ladders that don't have floor at their top tier
  for (const ol of finalOrange) {
    const endTier = Math.round(ol.y1 / tierHeight);
    const fd = data.floors.find((f) => f.tier === endTier);
    const hasFloor = fd && fd.sections.some((s) =>
      ol.x < s.x + s.w + 1 && ol.x + ol.w > s.x - 1 &&
      ol.z < s.z + s.d + 1 && ol.z + ol.d > s.z - 1
    );
    if (!hasFloor) ol.bad = true;
  }

  // Cyan (interior) ladder cull
  const culledInterior = DELETIONS.cyanLadderCull
    ? (rng.shuffle(interiorLadders), interiorLadders.slice(0, Math.max(1, Math.ceil(interiorLadders.length * CONNECTIVITY.cyanLadderCullRatio))))
    : interiorLadders;

  // Cyan ladder proximity cull (against other cyan, same start tier)
  let finalInterior;
  if (DELETIONS.cyanLadderProximityCull) {
    const cyanDropSet = new Set();
    for (let i = 0; i < culledInterior.length; i++) {
      if (cyanDropSet.has(i)) continue;
      for (let j = i + 1; j < culledInterior.length; j++) {
        if (cyanDropSet.has(j)) continue;
        if (Math.abs(culledInterior[i].y0 - culledInterior[j].y0) > 0.5) continue;
        if (isClose(culledInterior[i], culledInterior[j], PROXIMITY)) {
          cyanDropSet.add(j);
        }
      }
    }
    finalInterior = culledInterior.filter((_, i) => !cyanDropSet.has(i));
  } else {
    finalInterior = culledInterior;
  }

  // Remove cyan ladders that touch orange ladders
  if (DELETIONS.cyanLadderOrangeOverlap) {
    finalInterior = finalInterior.filter((cl) => {
      for (const ol of finalOrange) {
        if (cl.x < ol.x + ol.w && cl.x + cl.w > ol.x &&
            cl.z < ol.z + ol.d && cl.z + cl.d > ol.z) {
          return false;
        }
      }
      return true;
    });
  }

  // Remove cyan and orange ladders whose top is near a walkway
  const topDist = CONNECTIVITY.ladderTopWalkwayDist;
  if (DELETIONS.cyanLadderTopNearWalkway) {
    finalInterior = finalInterior.filter((l) => {
      for (const w of finalWalkways) {
        if (Math.abs(l.y1 - w.y) > 1) continue;
        if (isClose(l, w, topDist)) return false;
      }
      return true;
    });
  }
  if (DELETIONS.orangeLadderTopNearWalkway) {
    finalOrange = finalOrange.filter((l) => {
      for (const w of finalWalkways) {
        if (Math.abs(l.y1 - w.y) > 1) continue;
        if (isClose(l, w, topDist)) return false;
      }
      return true;
    });
  }

  // Remove yellow ladders whose parent walkway was deleted
  const survivingYellow = finalYellow.filter((l) =>
    finalWalkways.includes(l.parentWalkway)
  );

  // Generate ladder platforms — 2x2" platforms at each floor a ladder spans
  const PLATFORM_SIZE = GEOMETRY.platformSize;
  const PLATFORM_THICKNESS = GEOMETRY.platformThickness;
  const ladderPlatforms = [];
  const allLadders = [...survivingYellow, ...finalRed, ...finalOrange, ...finalInterior];

  for (let li = 0; li < allLadders.length; li++) {
    const ladder = allLadders[li];
    if (ladder.bad) continue;
    const startTier = Math.ceil(ladder.y0 / tierHeight);
    const endTier = Math.floor(ladder.y1 / tierHeight);

    for (let t = startTier; t <= endTier; t++) {
      const py = t * tierHeight;
      // Skip if platform is at the very bottom or top of the ladder
      if (Math.abs(py - ladder.y0) < 0.1 || Math.abs(py - ladder.y1) < 0.1) continue;

      // Centre platform on the ladder's wide axis, align outer edge with ladder's outer face
      let px, pz;
      if (ladder.w < ladder.d) {
        // Thin in X (ladder flat against wall in X) — extend platform outward in X
        // Find nearest building to determine which side the wall is on
        let nearestBuildingCx = ladder.x; // default
        for (const b of data.buildings) {
          if (ladder.z + ladder.d > b.z && ladder.z < b.z + b.d &&
              Math.abs(ladder.x - b.x) < b.w + 1) {
            nearestBuildingCx = b.x + b.w / 2;
            break;
          }
        }
        // If ladder is to the right of building centre, extend right; else left
        if (ladder.x > nearestBuildingCx) {
          px = ladder.x; // flush with ladder, extending right
        } else {
          px = ladder.x + ladder.w - PLATFORM_SIZE; // flush, extending left
        }
        pz = ladder.z + ladder.d / 2 - PLATFORM_SIZE / 2;
      } else {
        // Thin in Z (ladder flat against wall in Z)
        px = ladder.x + ladder.w / 2 - PLATFORM_SIZE / 2;
        let nearestBuildingCz = ladder.z;
        for (const b of data.buildings) {
          if (ladder.x + ladder.w > b.x && ladder.x < b.x + b.w &&
              Math.abs(ladder.z - b.z) < b.d + 1) {
            nearestBuildingCz = b.z + b.d / 2;
            break;
          }
        }
        if (ladder.z > nearestBuildingCz) {
          pz = ladder.z;
        } else {
          pz = ladder.z + ladder.d - PLATFORM_SIZE;
        }
      }

      ladderPlatforms.push({
        x: px, z: pz,
        w: PLATFORM_SIZE, d: PLATFORM_SIZE,
        y: py,
        ladderIndex: li,
      });
    }
  }

  // Remove platforms that touch walkways
  const filteredPlatforms = ladderPlatforms.filter((p) => {
    for (const w of finalWalkways) {
      if (Math.abs(p.y - w.y) > 1) continue;
      if (p.x < w.x + w.w && p.x + p.w > w.x &&
          p.z < w.z + w.d && p.z + p.d > w.z) {
        return false;
      }
    }
    return true;
  });

  // Tower ladders — placed last so they don't overlap existing ladders
  // Collect all existing ladders for overlap checking
  const allExistingLadders = [...survivingYellow, ...finalRed, ...finalOrange, ...finalInterior];

  for (const building of towerBuildings) {
    const topTier = building.pyramidRoof ? building.maxTier - 1 : building.maxTier;
    if (topTier < 1) continue;

    const y0 = 0;
    const y1 = topTier * tierHeight;

    // Try each side, pick one that doesn't overlap any existing ladder
    const sides = rng.shuffle(['north', 'south', 'east', 'west']);
    let placed = false;

    for (const side of sides) {
      let lx, lz, lw, ld;
      if (side === 'north') {
        lx = building.x + building.w / 2 - LADDER_WIDTH / 2;
        lz = building.z - LADDER_DEPTH;
        lw = LADDER_WIDTH; ld = LADDER_DEPTH;
      } else if (side === 'south') {
        lx = building.x + building.w / 2 - LADDER_WIDTH / 2;
        lz = building.z + building.d;
        lw = LADDER_WIDTH; ld = LADDER_DEPTH;
      } else if (side === 'west') {
        lx = building.x - LADDER_DEPTH;
        lz = building.z + building.d / 2 - LADDER_WIDTH / 2;
        lw = LADDER_DEPTH; ld = LADDER_WIDTH;
      } else {
        lx = building.x + building.w;
        lz = building.z + building.d / 2 - LADDER_WIDTH / 2;
        lw = LADDER_DEPTH; ld = LADDER_WIDTH;
      }

      // Check map bounds
      if (lx < 0 || lz < 0 || lx + lw > config.mapWidth || lz + ld > config.mapDepth) continue;

      // Check overlap with any existing ladder
      let overlaps = false;
      for (const el of allExistingLadders) {
        if (lx < el.x + (el.w || 1) + 0.3 && lx + lw > el.x - 0.3 &&
            lz < el.z + (el.d || 1) + 0.3 && lz + ld > el.z - 0.3) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      // Place the ladder
      const ladder = { type: 'ground_ladder', x: lx, z: lz, w: lw, d: ld, y0, y1 };
      finalRed.push(ladder);
      allExistingLadders.push(ladder);
      placed = true;

      // Delete wall segments that overlap the ladder at the termination floor
      const exitY = topTier * tierHeight;
      for (let wi = data.walls.length - 1; wi >= 0; wi--) {
        const wall = data.walls[wi];
        if (wall.baseY < exitY) continue;
        const wx1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wz1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        if (lx < wx1 + 0.3 && lx + lw > wall.x - 0.3 &&
            lz < wz1 + 0.3 && lz + ld > wall.z - 0.3) {
          data.walls.splice(wi, 1);
        }
      }
      break;
    }
    // If no side is free, skip this tower's ladder
  }

  // Gap detection: add forced connections before bridge upgrade so they can become bridges
  const gapWalkways = detectGapsAndConnect(data, finalWalkways, [], config, rng);
  finalWalkways.push(...gapWalkways);

  // Upgrade some tier 2+ walkways (including forced ones) to bridges
  const bridges = [];
  const remainingWalkways = [];
  const bridgeVariants = CONNECTIVITY.bridgeVariants;

  for (const w of finalWalkways) {
    const walkwayTier = Math.round(w.y / tierHeight);
    if (walkwayTier >= 2 && rng.chance(CONNECTIVITY.bridgeChance)) {
      // Pick variant
      const entries = Object.entries(bridgeVariants);
      const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
      const roll = rng.random() * totalWeight;
      let cum = 0, variant = entries[0][0];
      for (const [name, v] of entries) {
        cum += v.weight;
        if (roll < cum) { variant = name; break; }
      }

      // Widen the bridge (centre it on the original walkway centre)
      const bw = CONNECTIVITY.bridgeWidth;
      let bridge;
      if (w.axis === 'x') {
        const centreZ = w.z + w.d / 2;
        bridge = { ...w, type: 'bridge', z: centreZ - bw / 2, d: bw, variant };
      } else {
        const centreX = w.x + w.w / 2;
        bridge = { ...w, type: 'bridge', x: centreX - bw / 2, w: bw, variant };
      }
      bridges.push(bridge);
    } else {
      remainingWalkways.push(w);
    }
  }

  const connections = { ladders: survivingYellow, walkways: remainingWalkways, bridges, groundLadders: finalRed, orangeLadders: finalOrange, interiorLadders: finalInterior, ladderPlatforms: filteredPlatforms };
  return { ...data, connections };
}

/**
 * Grid-based gap detection: build a spatial grid per tier, scan for gaps, generate forced walkways.
 */
function detectGapsAndConnect(data, existingWalkways, existingBridges, config, rng) {
  const { tierHeight, slabThickness } = config;
  const buildings = data.buildings;
  const floors = data.floors;
  const walls = data.walls;
  const forced = [];

  // Grid cell size — 1 inch for precise alignment with building edges
  const cellSize = 1;
  const gridW = Math.ceil(config.mapWidth / cellSize);
  const gridD = Math.ceil(config.mapDepth / cellSize);

  // Track which building pairs already have a forced connection (shared across all tiers)
  const connectedPairs = new Set();

  // Resolve building index to its group (textureGroup or own index)
  function bldGroup(bi) {
    if (bi < 0 || bi >= buildings.length) return bi;
    const tg = buildings[bi].textureGroup;
    return tg !== undefined ? tg : bi;
  }

  function makePairKey(a, b) {
    const ga = bldGroup(a), gb = bldGroup(b);
    if (ga === gb) return null; // same building/composite — skip
    return Math.min(ga, gb) + ':' + Math.max(ga, gb);
  }

  // Also pre-populate from existing walkways/bridges
  function findBldForPoint(x, z) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (x >= b.x - 1.5 && x <= b.x + b.w + 1.5 && z >= b.z - 1.5 && z <= b.z + b.d + 1.5) return i;
    }
    return -1;
  }
  for (const ew of existingWalkways) {
    let s, e;
    if (ew.axis === 'x') {
      s = findBldForPoint(ew.x, ew.z + (ew.d || 2) / 2);
      e = findBldForPoint(ew.x + ew.w, ew.z + (ew.d || 2) / 2);
    } else {
      s = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z);
      e = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z + ew.d);
    }
    if (s >= 0 && e >= 0 && s !== e) {
      const pk = makePairKey(s, e);
      if (pk) connectedPairs.add(pk);
    }
  }

  // Build a grid per tier
  for (let tier = 1; tier <= config.tiers; tier++) {
    const tierFloors = floors[tier];
    if (!tierFloors || tierFloors.sections.length < 2) continue;

    // Create grid: each cell = { buildingIndex, hasFloor, walkways: [{axis, tier}] }
    const grid = Array.from({ length: gridD }, () =>
      Array.from({ length: gridW }, () => ({ buildingIndex: -1, hasFloor: false, walkways: [] }))
    );

    // Mark existing walkways/bridges on the grid with their axis and tier
    for (const ew of [...existingWalkways, ...existingBridges]) {
      const ewTier = Math.round(ew.y / tierHeight);
      const c0 = Math.floor(ew.x / cellSize);
      const c1 = Math.floor((ew.x + ew.w - 0.01) / cellSize);
      const r0 = Math.floor(ew.z / cellSize);
      const r1 = Math.floor((ew.z + ew.d - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          grid[r][c].walkways.push({ axis: ew.axis, tier: ewTier });
        }
      }
    }

    // Populate grid from floor sections
    for (const section of tierFloors.sections) {
      // Find which building this section belongs to
      let bi = -1;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (section.x >= b.x - 0.5 && section.x + section.w <= b.x + b.w + 0.5 &&
            section.z >= b.z - 0.5 && section.z + section.d <= b.z + b.d + 0.5) {
          bi = i;
          break;
        }
      }

      // Fill grid cells covered by this section
      const col0 = Math.floor(section.x / cellSize);
      const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
      const row0 = Math.floor(section.z / cellSize);
      const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
      for (let r = row0; r <= row1 && r < gridD; r++) {
        for (let c = col0; c <= col1 && c < gridW; c++) {
          if (r >= 0 && c >= 0) {
            grid[r][c].hasFloor = true;
            grid[r][c].buildingIndex = bi;
          }
        }
      }
    }

    // Also populate grid from roof sections at this tier (roofs are walkable surfaces)
    if (data.roofs) {
      for (const r of data.roofs) {
        if (r.tier !== tier) continue;
        const section = r.section || r.building;
        if (!section) continue;

        let bi = r.buildingIndex;
        if (bi === undefined || bi < 0) bi = -1;

        const col0 = Math.floor(section.x / cellSize);
        const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
        const row0 = Math.floor(section.z / cellSize);
        const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
        for (let row = row0; row <= row1 && row < gridD; row++) {
          for (let c = col0; c <= col1 && c < gridW; c++) {
            if (row >= 0 && c >= 0) {
              grid[row][c].hasFloor = true;
              if (bi >= 0) grid[row][c].buildingIndex = bi;
            }
          }
        }
      }
    }

    // Helper: mark a walkway's cells on the grid
    function markWalkwayOnGrid(w) {
      const wTier = Math.round(w.y / tierHeight);
      const c0 = Math.floor(w.x / cellSize);
      const c1 = Math.floor((w.x + w.w - 0.01) / cellSize);
      const r0 = Math.floor(w.z / cellSize);
      const r1 = Math.floor((w.z + w.d - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          grid[r][c].walkways.push({ axis: w.axis, tier: wTier });
        }
      }
    }

    // Helper: check if a proposed walkway crosses a cell with an existing walkway at the same tier
    // Blocks ANY axis crossing at the same tier (prevents criss-crossing)
    function crossesWalkway(wx, wz, ww, wd, wAxis, wTier) {
      const c0 = Math.floor(wx / cellSize);
      const c1 = Math.floor((wx + ww - 0.01) / cellSize);
      const r0 = Math.floor(wz / cellSize);
      const r1 = Math.floor((wz + wd - 0.01) / cellSize);
      for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
          for (const ew of grid[r][c].walkways) {
            if (ew.tier === wTier) return true;
          }
        }
      }
      return false;
    }

    // Helper: check if a proposed walkway passes through a floor or roof at the same tier
    // wAxis: 'x' or 'z' — the axis the walkway runs along
    function passesThrough(wx, wz, ww, wd, wTier, wAxis) {
      // Check floor sections at this tier — block if walkway passes through along its travel axis
      const fl = floors[wTier];
      if (fl) {
        for (const s of fl.sections) {
          const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
          // Only block if there's significant overlap along the walkway's travel direction
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      // Check roofs at this tier
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier !== wTier) continue;
          const s = r.section || r.building;
          if (!s) continue;
          const sw = s.w || 0, sd = s.d || 0;
          const overlapX = Math.min(wx + ww, s.x + sw) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + sd) - Math.max(wz, s.z);
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      // Check floors at other tiers — only block SAME orientation overlaps
      // A N/S walkway shouldn't be blocked by a floor that an E/W walkway would pass through
      for (let t = 1; t <= config.tiers; t++) {
        if (t === wTier) continue;
        if (wTier > t) continue; // only block if walkway is at or below this tier
        const otherFl = floors[t];
        if (!otherFl) continue;
        for (const s of otherFl.sections) {
          const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
          const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
          if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
          if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
        }
      }
      return false;
    }

    // Helper: check if a proposed walkway stacks on another FORCED connection (same axis, different tier, XZ overlap)
    // Allows stacking on regular walkways — forced connections fill critical gaps
    function isStackedOnForced(w) {
      for (const ew of forced) {
        if (ew.axis !== w.axis) continue;
        if (Math.abs(ew.y - w.y) < 0.5) continue;
        if (w.x < ew.x + ew.w && w.x + w.w > ew.x && w.z < ew.z + ew.d && w.z + w.d > ew.z) {
          return true;
        }
      }
      return false;
    }

    // Helper: find the actual floor section edge for a building at this tier near a grid position
    function findFloorEdge(bi, axis, side, gridPos) {
      const allSections = [...(tierFloors ? tierFloors.sections : [])];
      // Also check roofs at this tier
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier === tier && r.section) allSections.push(r.section);
        }
      }
      const bld = buildings[bi];
      if (!bld) return null;
      let bestEdge = null;
      for (const s of allSections) {
        if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
            s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;

        if (axis === 'x') {
          const rowZ = gridPos * cellSize;
          if (s.z <= rowZ + cellSize && s.z + s.d >= rowZ) {
            const edge = side === 'end' ? s.x + s.w : s.x;
            if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
          }
        } else {
          const colX = gridPos * cellSize;
          if (s.x <= colX + cellSize && s.x + s.w >= colX) {
            const edge = side === 'end' ? s.z + s.d : s.z;
            if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
          }
        }
      }
      return bestEdge;
    }

    const minGap = CONNECTIVITY.forcedMinGap || 6;
    const diagTol = CONNECTIVITY.forcedDiagTolerance || 4;

    // Helper: at a forced connection endpoint, find blocking walls and clear them if >50% coverage
    // Returns false if the endpoint has no accessible floor (no connection possible)
    function clearBlockingWalls(candidate, endpointX, endpointZ, facingDir) {
      // facingDir: 'east'|'west'|'north'|'south' — the building face the walkway arrives at
      const wt = config.wallThickness;
      const tierY = candidate.y;
      const tierH = config.tierHeight;

      // Determine the cross-axis span of the walkway at this endpoint
      let crossMin, crossMax;
      if (candidate.axis === 'x') {
        crossMin = candidate.z;
        crossMax = candidate.z + candidate.d;
      } else {
        crossMin = candidate.x;
        crossMax = candidate.x + candidate.w;
      }
      const walkwaySpan = crossMax - crossMin;

      // Find wall segments at this face that overlap the walkway's cross-axis span
      const blocking = [];
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        // Wall must be at the right tier (baseY within this tier's range)
        if (w.baseY < tierY - tierH + 0.1 || w.baseY > tierY + 0.1) continue;

        if (facingDir === 'east' || facingDir === 'west') {
          // East/west faces: wall runs along Z axis
          if (w.axis !== 'z') continue;
          // Wall X must be flush with the endpoint
          if (Math.abs(w.x - endpointX) > wt + 0.5 && Math.abs(w.x + wt - endpointX) > 0.5) continue;
          // Check Z overlap with walkway span
          const overlapMin = Math.max(w.z, crossMin);
          const overlapMax = Math.min(w.z + w.length, crossMax);
          if (overlapMax > overlapMin) {
            blocking.push({ index: i, overlap: overlapMax - overlapMin });
          }
        } else {
          // North/south faces: wall runs along X axis
          if (w.axis !== 'x') continue;
          // Wall Z must be flush with the endpoint
          if (Math.abs(w.z - endpointZ) > wt + 0.5 && Math.abs(w.z + wt - endpointZ) > 0.5) continue;
          // Check X overlap with walkway span
          const overlapMin = Math.max(w.x, crossMin);
          const overlapMax = Math.min(w.x + w.length, crossMax);
          if (overlapMax > overlapMin) {
            blocking.push({ index: i, overlap: overlapMax - overlapMin });
          }
        }
      }

      if (blocking.length === 0) return true; // no walls blocking, all good

      const totalBlocked = blocking.reduce((sum, b) => sum + b.overlap, 0);
      const coverage = totalBlocked / walkwaySpan;

      if (coverage > 0.5) {
        // Wall blocks >50% — delete the blocking wall segments to make room
        const toRemove = blocking.map(b => b.index).sort((a, b) => b - a); // reverse order for safe splice
        for (const idx of toRemove) {
          walls.splice(idx, 1);
        }
      }
      // coverage <= 50%: leave walls as-is, models can get through
      return true;
    }

    // Helper: find the cross-axis range of floor/roof sections at a building's endpoint edge
    // Returns { min, max } or null if no floor found at that edge
    function findCrossAxisRange(bi, edgeAxis, edgeSide, edgePos) {
      const bld = buildings[bi];
      if (!bld) return null;
      const allSections = [...(tierFloors ? tierFloors.sections : [])];
      if (data.roofs) {
        for (const r of data.roofs) {
          if (r.tier === tier && r.section) allSections.push(r.section);
        }
      }
      let rangeMin = Infinity, rangeMax = -Infinity;
      for (const s of allSections) {
        if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
            s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;
        if (edgeAxis === 'x') {
          const sEdge = edgeSide === 'end' ? s.x + s.w : s.x;
          if (Math.abs(sEdge - edgePos) > 0.5) continue;
          if (s.z < rangeMin) rangeMin = s.z;
          if (s.z + s.d > rangeMax) rangeMax = s.z + s.d;
        } else {
          const sEdge = edgeSide === 'end' ? s.z + s.d : s.z;
          if (Math.abs(sEdge - edgePos) > 0.5) continue;
          if (s.x < rangeMin) rangeMin = s.x;
          if (s.x + s.w > rangeMax) rangeMax = s.x + s.w;
        }
      }
      return rangeMin < rangeMax ? { min: rangeMin, max: rangeMax } : null;
    }

    // Helper: try to place a forced connection, return true if placed
    function tryForceConnection(axis, startBI, endBI, scanPos) {
      // Try the exact scan position first, then nearby rows/cols within diagonal tolerance
      const positions = [scanPos];
      for (let offset = 1; offset <= diagTol; offset++) {
        positions.push(scanPos + offset);
        positions.push(scanPos - offset);
      }

      for (const pos of positions) {
        if (pos < 0 || pos >= (axis === 'x' ? gridD : gridW)) continue;

        if (axis === 'x') {
          const startX = findFloorEdge(startBI, 'x', 'end', pos);
          const endX = findFloorEdge(endBI, 'x', 'start', pos);
          if (startX === null || endX === null || endX - startX < minGap) continue;
          if (endX - startX > config.mapWidth / 2) continue;

          // Clamp walkway Z to the overlap of both endpoint floor ranges
          const startRange = findCrossAxisRange(startBI, 'x', 'end', startX);
          const endRange = findCrossAxisRange(endBI, 'x', 'start', endX);
          if (!startRange || !endRange) continue;
          const overlapMin = Math.max(startRange.min, endRange.min);
          const overlapMax = Math.min(startRange.max, endRange.max);
          if (overlapMax - overlapMin < WALKWAY_WIDTH) continue; // not enough shared range
          const clampedZ = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

          const candidate = {
            type: 'walkway', x: startX, z: clampedZ - WALKWAY_WIDTH / 2,
            w: endX - startX, d: WALKWAY_WIDTH, y: tier * tierHeight, axis: 'x', forced: true,
          };

          if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'x') &&
              !isStackedOnForced(candidate) &&
              !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier)) {
            // Clear blocking walls at both endpoints (start building's east face, end building's west face)
            clearBlockingWalls(candidate, startX, null, 'east');
            clearBlockingWalls(candidate, endX, null, 'west');
            forced.push(candidate);
            markWalkwayOnGrid(candidate);
            return true;
          }
        } else {
          const startZ = findFloorEdge(startBI, 'z', 'end', pos);
          const endZ = findFloorEdge(endBI, 'z', 'start', pos);
          if (startZ === null || endZ === null || endZ - startZ < minGap) continue;
          if (endZ - startZ > config.mapWidth / 2) continue;

          // Clamp walkway X to the overlap of both endpoint floor ranges
          const startRange = findCrossAxisRange(startBI, 'z', 'end', startZ);
          const endRange = findCrossAxisRange(endBI, 'z', 'start', endZ);
          if (!startRange || !endRange) continue;
          const overlapMin = Math.max(startRange.min, endRange.min);
          const overlapMax = Math.min(startRange.max, endRange.max);
          if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;
          const clampedX = Math.max(overlapMin + WALKWAY_WIDTH / 2, Math.min(pos * cellSize + cellSize / 2, overlapMax - WALKWAY_WIDTH / 2));

          const candidate = {
            type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: startZ,
            w: WALKWAY_WIDTH, d: endZ - startZ, y: tier * tierHeight, axis: 'z', forced: true,
          };

          if (!passesThrough(candidate.x, candidate.z, candidate.w, candidate.d, tier, 'z') &&
              !isStackedOnForced(candidate) &&
              !crossesWalkway(candidate.x, candidate.z, candidate.w, candidate.d, candidate.axis, tier)) {
            // Clear blocking walls at both endpoints (start building's south face, end building's north face)
            clearBlockingWalls(candidate, null, startZ, 'south');
            clearBlockingWalls(candidate, null, endZ, 'north');
            forced.push(candidate);
            markWalkwayOnGrid(candidate);
            return true;
          }
        }
      }
      return false;
    }

    // Scan rows for horizontal gaps (walkway along X axis)
    for (let r = 0; r < gridD; r++) {
      let lastOccupied = -1;
      let lastBI = -1;
      for (let c = 0; c < gridW; c++) {
        const cell = grid[r][c];
        if (cell.hasFloor && cell.buildingIndex >= 0) {
          if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
            const gapCells = c - lastOccupied - 1;
            if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
              const pairKey = makePairKey(lastBI, cell.buildingIndex);
              if (pairKey && !connectedPairs.has(pairKey)) {
                if (tryForceConnection('x', lastBI, cell.buildingIndex, r)) {
                  connectedPairs.add(pairKey);
                }
              }
            }
          }
          lastOccupied = c;
          lastBI = cell.buildingIndex;
        }
      }
    }

    // Scan columns for vertical gaps (walkway along Z axis)
    for (let c = 0; c < gridW; c++) {
      let lastOccupied = -1;
      let lastBI = -1;
      for (let r = 0; r < gridD; r++) {
        const cell = grid[r][c];
        if (cell.hasFloor && cell.buildingIndex >= 0) {
          if (lastOccupied >= 0 && lastBI !== cell.buildingIndex) {
            const gapCells = r - lastOccupied - 1;
            if (gapCells * cellSize >= minGap && gapCells * cellSize <= config.mapWidth / 2) {
              const pairKey = makePairKey(lastBI, cell.buildingIndex);
              if (pairKey && !connectedPairs.has(pairKey)) {
                if (tryForceConnection('z', lastBI, cell.buildingIndex, c)) {
                  connectedPairs.add(pairKey);
                }
              }
            }
          }
          lastOccupied = r;
          lastBI = cell.buildingIndex;
        }
      }
    }
  }

  // Deduplicate — remove forced walkways that overlap each other in XZ
  const deduped = [];
  for (const fw of forced) {
    let overlaps = false;
    for (const existing of deduped) {
      if (existing.axis !== fw.axis) continue;
      if (Math.abs(existing.y - fw.y) > 0.5) continue;
      if (fw.x < existing.x + existing.w + 1 && fw.x + fw.w > existing.x - 1 &&
          fw.z < existing.z + existing.d + 1 && fw.z + fw.d > existing.z - 1) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) deduped.push(fw);
  }

  // Limit to a reasonable number — keep the longest ones (biggest gaps are most useful)
  deduped.sort((a, b) => {
    const lenA = a.axis === 'x' ? a.w : a.d;
    const lenB = b.axis === 'x' ? b.w : b.d;
    return lenB - lenA;
  });
  const countRange = CONNECTIVITY.forcedMaxCount;
  const maxForced = Array.isArray(countRange)
    ? Math.min(deduped.length, rng.int(countRange[0], countRange[1]))
    : Math.min(deduped.length, countRange || 15);
  const result = deduped.slice(0, maxForced);

  if (result.length > 0) console.log('  Gap detection: ' + result.length + ' forced walkways');
  return result;
}

/**
 * Check if two objects are within a given distance (edge-to-edge).
 */
function isClose(a, b, dist) {
  const ax1 = a.x, ax2 = a.x + (a.w || 0);
  const az1 = a.z, az2 = a.z + (a.d || 0);
  const bx1 = b.x, bx2 = b.x + (b.w || 0);
  const bz1 = b.z, bz2 = b.z + (b.d || 0);

  // Gap between edges (0 or negative if overlapping)
  const gapX = Math.max(0, Math.max(ax1 - bx2, bx1 - ax2));
  const gapZ = Math.max(0, Math.max(az1 - bz2, bz1 - az2));

  return gapX <= dist && gapZ <= dist;
}

/**
 * Check if two walkways intersect (AABB overlap at the same tier).
 */
function walkwaysIntersect(a, b) {
  if (Math.abs(a.y - b.y) > 0.5) return false; // different tiers
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.z < b.z + b.d &&
    a.z + a.d > b.z
  );
}

/**
 * Get the rectangle for a specific quadrant of a building.
 */
function getQuadrantRect(building, q) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;
  switch (q) {
    case 0: return { x: building.x, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 1: return { x: mx, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 2: return { x: building.x, z: mz, w: building.w / 2, d: building.d / 2 };
    case 3: return { x: mx, z: mz, w: building.w / 2, d: building.d / 2 };
  }
}

/**
 * Find which building a section belongs to.
 */
function findBuildingIndex(section, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (section.x >= b.x - 0.1 && section.z >= b.z - 0.1 &&
        section.x + section.w <= b.x + b.w + 0.1 &&
        section.z + section.d <= b.z + b.d + 0.1) {
      return i;
    }
  }
  return -1;
}
