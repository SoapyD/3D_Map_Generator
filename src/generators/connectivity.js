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

import { CONNECTIVITY } from '../config.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;
const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;
const RAMP_DEPTH = 4.0;     // length of the ramp along ground
const RAMP_THICKNESS = 0.3;

export function generateConnectivity(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const ladders = [];
  const walkways = [];
  const ramps = [];

  // Build nodes: one per floor section per tier (skip tier 0 base)
  const nodes = [];
  for (let t = 1; t < data.floors.length; t++) {
    const tier = data.floors[t].tier;
    for (const section of data.floors[t].sections) {
      // Find which building this section belongs to
      const bi = findBuildingIndex(section, data.buildings);
      nodes.push({ tier, section, buildingIndex: bi, reachable: false });
    }
  }

  // Tier 0 is always reachable (it's the ground)
  // Mark tier 1 sections that touch ground as reachable via ground adjacency
  // (they're on the ground floor of buildings — reachable by walking in)

  // Build adjacency: same-tier sections that share an edge
  const adjacency = buildAdjacency(nodes);

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

        // Try connecting from each of the quadrant's 4 edges
        const edges = [
          { side: 'north', x: srcRect.x + srcRect.w / 2, z: srcRect.z },
          { side: 'south', x: srcRect.x + srcRect.w / 2, z: srcRect.z + srcRect.d },
          { side: 'west',  x: srcRect.x, z: srcRect.z + srcRect.d / 2 },
          { side: 'east',  x: srcRect.x + srcRect.w, z: srcRect.z + srcRect.d / 2 },
        ];

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
          if (hitsWall) {
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
          if (!startTouches || !endTouches) continue;

          walkways.push(walkway);
        }
      }
    }
  }

  // Strip intersecting walkways: loop through, if current walkway intersects
  // another, mark the other for dropping. Skip intersection checks against
  // walkways already marked for dropping.
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
  const filteredWalkways = walkways.filter((_, i) => !toDrop.has(i));

  // Keep only 20% of walkways per tier
  const byTier = new Map();
  for (const w of filteredWalkways) {
    const t = Math.round(w.y / tierHeight);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(w);
  }
  const culledWalkways = [];
  for (const [, tierWalkways] of byTier) {
    rng.shuffle(tierWalkways);
    const keep = Math.max(1, Math.ceil(tierWalkways.length * CONNECTIVITY.walkwayKeepRatio));
    culledWalkways.push(...tierWalkways.slice(0, keep));
  }

  // For blocked walkways, place a ladder on the side(s) that touch a wall.
  // Ladder goes up from the walkway until it reaches a tier with no wall.
  const LADDER_WIDTH = 1.0;
  const LADDER_DEPTH = 0.5;

  for (const w of culledWalkways) {
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

      const ladderY0 = w.y; // start at walkway level
      const ladderY1 = (topTier + 1) * tierHeight;

      if (ladderY1 > ladderY0) {
        ladders.push({
          type: 'ladder',
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
        const groundWallY = 0 * tierHeight + slabThickness;
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
        let ladderTopTier = topTier + 1;
        while (ladderTopTier > 0) {
          const floorData2 = data.floors.find((f) => f.tier === ladderTopTier);
          if (floorData2 && floorData2.sections.some((s) =>
            s.x < qr.x + qr.w - 0.1 && s.x + s.w > qr.x + 0.1 &&
            s.z < qr.z + qr.d - 0.1 && s.z + s.d > qr.z + 0.1
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
  const filteredGroundLadders = groundLadders.filter((gl) => {
    for (const w of culledWalkways) {
      if (gl.x < w.x + w.w && gl.x + gl.w > w.x &&
          gl.z < w.z + w.d && gl.z + gl.d > w.z) {
        return false;
      }
    }
    return true;
  });

  // Orange ladders: placed on any quadrant edge, any tier except top.
  // Go up one tier. Only kept if they connect to a floor above.
  // Deleted if they touch a walkway or red ladder.
  const orangeLadders = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
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
          const y0 = tier * tierHeight;
          let topTier = tier;
          for (let t = tier + 1; t <= config.tiers; t++) {
            const floorAtT = data.floors.find((f) => f.tier === t);
            if (floorAtT && floorAtT.sections.some((s) =>
              s.x < qr.x + qr.w - 0.1 && s.x + s.w > qr.x + 0.1 &&
              s.z < qr.z + qr.d - 0.1 && s.z + s.d > qr.z + 0.1
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

  // Remove orange ladders that touch any walkway or red ladder
  const filteredOrangeLadders = orangeLadders.filter((ol) => {
    for (const w of culledWalkways) {
      if (ol.x < w.x + w.w && ol.x + ol.w > w.x &&
          ol.z < w.z + w.d && ol.z + ol.d > w.z) {
        return false;
      }
    }
    for (const gl of filteredGroundLadders) {
      if (ol.x < gl.x + gl.w && ol.x + ol.w > gl.x &&
          ol.z < gl.z + gl.d && ol.z + ol.d > gl.z) {
        return false;
      }
    }
    return true;
  });

  // Cull red and orange ladders to 40% each
  rng.shuffle(filteredGroundLadders);
  const culledGroundLadders = filteredGroundLadders.slice(0, Math.max(1, Math.ceil(filteredGroundLadders.length * CONNECTIVITY.ladderCullRatio)));

  rng.shuffle(filteredOrangeLadders);
  const culledOrangeLadders = filteredOrangeLadders.slice(0, Math.max(1, Math.ceil(filteredOrangeLadders.length * CONNECTIVITY.ladderCullRatio)));

  // Proximity culling — only delete if same tier start point
  const PROXIMITY = CONNECTIVITY.proximity;

  // Walkways
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
  const finalWalkways = culledWalkways.filter((_, i) => !walkwayDropSet.has(i));

  // Yellow ladders vs red + orange (same start tier only)
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
  const finalYellow = ladders.filter((_, i) => !yellowDropSet.has(i));

  // Red ladders vs red + orange (same start tier only)
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
  const finalRed = culledGroundLadders.filter((_, i) => !redDropSet.has(i));

  // Orange ladders vs other orange (same start tier only)
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
  const finalOrange = culledOrangeLadders.filter((_, i) => !orangeDropSet.has(i));

  const connections = { ladders: finalYellow, walkways: finalWalkways, groundLadders: finalRed, orangeLadders: finalOrange };
  return { ...data, connections };
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
 * Check if a walkway's endpoints collide with any wall at the same level.
 * Returns true if either end hits a wall.
 */
function walkwayHitsWall(walkway, nodeA, nodeB, walls, config) {
  const tierY = nodeA.tier * config.tierHeight + config.slabThickness;

  // Get the two endpoints of the walkway (the edges touching each building)
  const wx0 = walkway.x;
  const wz0 = walkway.z;
  const wx1 = walkway.x + walkway.w;
  const wz1 = walkway.z + walkway.d;

  for (const wall of walls) {
    // Only check walls on this exact tier
    if (Math.abs(wall.baseY - tierY) > 0.5) continue;

    const wallX0 = wall.x;
    const wallZ0 = wall.z;
    const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
    const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;

    // Check if the walkway's start edge overlaps with this wall
    // Check if the walkway's end edge overlaps with this wall
    const margin = 0.5;

    // Overlap test: walkway rect vs wall rect
    if (wx0 < wallX1 + margin && wx1 > wallX0 - margin &&
        wz0 < wallZ1 + margin && wz1 > wallZ0 - margin) {
      return true;
    }
  }

  return false;
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

/**
 * Build adjacency list: same-tier sections that share an edge.
 */
function buildAdjacency(nodes) {
  const adj = new Map();
  for (let i = 0; i < nodes.length; i++) {
    adj.set(i, []);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].tier !== nodes[j].tier) continue;
      if (sectionsShareEdge(nodes[i].section, nodes[j].section)) {
        adj.get(i).push(j);
        adj.get(j).push(i);
      }
    }
  }
  return adj;
}

function sectionsShareEdge(a, b) {
  const margin = 0.5;
  // Check if they share an X edge (adjacent in Z)
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (overlapX > margin) {
    if (Math.abs((a.z + a.d) - b.z) < margin || Math.abs((b.z + b.d) - a.z) < margin) return true;
  }
  // Check if they share a Z edge (adjacent in X)
  const overlapZ = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  if (overlapZ > margin) {
    if (Math.abs((a.x + a.w) - b.x) < margin || Math.abs((b.x + b.w) - a.x) < margin) return true;
  }
  return false;
}

/**
 * Propagate reachability through adjacency.
 */
function propagateReachability(startNode, nodes, adjacency) {
  const startIdx = nodes.indexOf(startNode);
  const queue = [startIdx];
  const visited = new Set([startIdx]);

  while (queue.length > 0) {
    const idx = queue.shift();
    nodes[idx].reachable = true;

    for (const neighbor of adjacency.get(idx) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}

/**
 * Place a ramp from ground level to a tier 1 section.
 */
function placeRamp(node, data, config, rng) {
  const s = node.section;
  const y0 = 0;
  const y1 = config.tierHeight;

  // Try placing ramp on each side of the section
  const sides = rng.shuffle(['south', 'north', 'east', 'west']);
  for (const side of sides) {
    let x, z, rampW, rampD, axis;

    switch (side) {
      case 'south':
        x = s.x + s.w / 2 - RAMP_WIDTH / 2;
        z = s.z + s.d;
        rampW = RAMP_WIDTH;
        rampD = RAMP_DEPTH;
        axis = 'z';
        break;
      case 'north':
        x = s.x + s.w / 2 - RAMP_WIDTH / 2;
        z = s.z - RAMP_DEPTH;
        rampW = RAMP_WIDTH;
        rampD = RAMP_DEPTH;
        axis = 'z';
        break;
      case 'east':
        x = s.x + s.w;
        z = s.z + s.d / 2 - RAMP_WIDTH / 2;
        rampW = RAMP_DEPTH;
        rampD = RAMP_WIDTH;
        axis = 'x';
        break;
      case 'west':
        x = s.x - RAMP_DEPTH;
        z = s.z + s.d / 2 - RAMP_WIDTH / 2;
        rampW = RAMP_DEPTH;
        rampD = RAMP_WIDTH;
        axis = 'x';
        break;
    }

    // Check ramp is within map bounds
    if (x >= 0 && z >= 0 && x + rampW <= config.mapWidth && z + rampD <= config.mapDepth) {
      return { type: 'ramp', x, z, w: rampW, d: rampD, y0, y1, axis, side };
    }
  }

  return null;
}

/**
 * Place a ladder between a lower and upper section within the same building.
 */
function placeLadder(lowerNode, upperNode, config, rng) {
  const lower = lowerNode.section;
  const upper = upperNode.section;

  // Find overlap area between the two sections
  const overlapX0 = Math.max(lower.x, upper.x);
  const overlapZ0 = Math.max(lower.z, upper.z);
  const overlapX1 = Math.min(lower.x + lower.w, upper.x + upper.w);
  const overlapZ1 = Math.min(lower.z + lower.d, upper.z + upper.d);

  if (overlapX1 - overlapX0 < LADDER_WIDTH || overlapZ1 - overlapZ0 < LADDER_DEPTH) {
    // No overlap — place ladder at the nearest edges
    const x = Math.max(lower.x, upper.x);
    const z = Math.max(lower.z, upper.z);
    return {
      type: 'ladder',
      x, z,
      w: LADDER_WIDTH,
      d: LADDER_DEPTH,
      y0: lowerNode.tier * config.tierHeight + config.slabThickness,
      y1: upperNode.tier * config.tierHeight,
    };
  }

  // Place ladder within the overlap area
  const x = rng.float(overlapX0, overlapX1 - LADDER_WIDTH);
  const z = rng.float(overlapZ0, overlapZ1 - LADDER_DEPTH);

  return {
    type: 'ladder',
    x, z,
    w: LADDER_WIDTH,
    d: LADDER_DEPTH,
    y0: lowerNode.tier * config.tierHeight + config.slabThickness,
    y1: upperNode.tier * config.tierHeight,
  };
}

/**
 * Place a walkway between two sections at the same tier in different buildings.
 */
function placeWalkway(fromNode, toNode, config, rng) {
  const a = fromNode.section;
  const b = toNode.section;
  const y = fromNode.tier * config.tierHeight;

  const aCx = a.x + a.w / 2;
  const aCz = a.z + a.d / 2;
  const bCx = b.x + b.w / 2;
  const bCz = b.z + b.d / 2;

  // Determine if walkway runs along X or Z
  const dx = Math.abs(aCx - bCx);
  const dz = Math.abs(aCz - bCz);

  let x, z, w, d, axis;

  if (dx > dz) {
    // Walkway runs along X
    const startX = Math.min(a.x + a.w, b.x + b.w);
    const endX = Math.max(a.x, b.x);
    const midZ = (aCz + bCz) / 2;
    x = Math.min(startX, endX);
    z = midZ - WALKWAY_WIDTH / 2;
    w = Math.abs(endX - startX);
    d = WALKWAY_WIDTH;
    axis = 'x';
  } else {
    // Walkway runs along Z
    const startZ = Math.min(a.z + a.d, b.z + b.d);
    const endZ = Math.max(a.z, b.z);
    const midX = (aCx + bCx) / 2;
    x = midX - WALKWAY_WIDTH / 2;
    z = Math.min(startZ, endZ);
    w = WALKWAY_WIDTH;
    d = Math.abs(endZ - startZ);
    axis = 'z';
  }

  // Minimum length check
  const length = axis === 'x' ? w : d;
  if (length < 1) return null;

  return { type: 'walkway', x, z, w, d, y, axis };
}

/**
 * Find nearest reachable node at the same tier in a different building.
 */
function findNearestReachable(node, nodes, tier) {
  let best = null;
  let bestDist = Infinity;

  const cx = node.section.x + node.section.w / 2;
  const cz = node.section.z + node.section.d / 2;

  for (const other of nodes) {
    if (other === node) continue;
    if (other.tier !== tier) continue;
    if (!other.reachable) continue;
    if (other.buildingIndex === node.buildingIndex) continue;

    const ox = other.section.x + other.section.w / 2;
    const oz = other.section.z + other.section.d / 2;
    const dist = Math.abs(cx - ox) + Math.abs(cz - oz);

    if (dist < bestDist) {
      bestDist = dist;
      best = other;
    }
  }

  // Only connect if within reasonable distance (20 inches)
  return bestDist < 20 ? best : null;
}

/**
 * Find nearest reachable node one tier below.
 */
function findNearestBelow(node, nodes, tier) {
  let best = null;
  let bestDist = Infinity;

  const cx = node.section.x + node.section.w / 2;
  const cz = node.section.z + node.section.d / 2;

  for (const other of nodes) {
    if (other.tier !== tier - 1) continue;
    if (!other.reachable) continue;

    const ox = other.section.x + other.section.w / 2;
    const oz = other.section.z + other.section.d / 2;
    const dist = Math.abs(cx - ox) + Math.abs(cz - oz);

    if (dist < bestDist) {
      bestDist = dist;
      best = other;
    }
  }

  return best;
}
