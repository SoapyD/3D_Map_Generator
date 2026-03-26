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

const LADDER_WIDTH = 1.0;   // inches
const LADDER_DEPTH = 0.5;   // inches
const WALKWAY_WIDTH = 2.0;  // inches
const WALKWAY_THICKNESS = 0.3;
const RAMP_WIDTH = 2.5;     // inches
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
            if (len < 3 || len > 15) continue;

            // Z position: middle of source edge, clamped to target's Z range
            const clampedZ = Math.max(tgtRect.z + WALKWAY_WIDTH / 2, Math.min(edge.z, tgtRect.z + tgtRect.d - WALKWAY_WIDTH / 2));
            walkway = { type: 'walkway', x: gs, z: clampedZ - WALKWAY_WIDTH / 2, w: len, d: WALKWAY_WIDTH, y, axis: 'x' };
          } else {
            // Walkway runs along Z
            const gs = edge.side === 'south' ? srcRect.z + srcRect.d : tgtRect.z + tgtRect.d;
            const ge = edge.side === 'south' ? tgtRect.z : srcRect.z;
            if (ge <= gs) continue;
            const len = ge - gs;
            if (len < 3 || len > 15) continue;

            // X position: middle of source edge, clamped to target's X range
            const clampedX = Math.max(tgtRect.x + WALKWAY_WIDTH / 2, Math.min(edge.x, tgtRect.x + tgtRect.w - WALKWAY_WIDTH / 2));
            walkway = { type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: gs, w: WALKWAY_WIDTH, d: len, y, axis: 'z' };
          }

          // Drop if it hits a wall on this tier
          const tierY = (tier - 1) * tierHeight + slabThickness;
          let hitsWall = false;
          for (const wall of data.walls) {
            if (Math.abs(wall.baseY - tierY) > 0.5) continue;
            const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
            const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
            if (walkway.x < wallX1 && walkway.x + walkway.w > wall.x &&
                walkway.z < wallZ1 && walkway.z + walkway.d > wall.z) {
              hitsWall = true;
              break;
            }
          }
          if (hitsWall) continue;

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

  const connections = { ladders, walkways: filteredWalkways };
  return { ...data, connections };
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
