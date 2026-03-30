/**
 * Geometry Helpers — utility functions for geometry-builder.js.
 *
 * Pure helper functions extracted from geometry-builder to keep the
 * main module focused on the buildGeometry() orchestration logic.
 */

/**
 * Find which building a floor section belongs to.
 */
export function findBuilding(x, z, w, d, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x >= b.x - 0.5 && z >= b.z - 0.5 &&
        x + w <= b.x + b.w + 0.5 && z + d <= b.z + b.d + 0.5) {
      return i;
    }
  }
  return -1;
}

/**
 * Find which building a wall belongs to (looser tolerance).
 */
export function findBuildingForWall(wall, buildings) {
  const wx = wall.axis === 'x' ? wall.x + wall.length / 2 : wall.x;
  const wz = wall.axis === 'z' ? wall.z + wall.length / 2 : wall.z;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x - 1 && wx <= b.x + b.w + 1 && wz >= b.z - 1 && wz <= b.z + b.d + 1) {
      return i;
    }
  }
  return -1;
}

/**
 * Get texture group index for a building (composite parts share textures).
 */
export function getTexGroup(bi, buildings) {
  if (bi < 0 || bi >= buildings.length) return bi;
  const b = buildings[bi];
  return b.textureGroup !== undefined ? b.textureGroup : bi;
}

/**
 * Determine wall texture category based on building size.
 */
export function wallTextureKey(bi, buildings) {
  if (bi < 0) return 'wall:landmark:0';
  const b = buildings[bi];
  const ti = getTexGroup(bi, buildings);
  if (b.size === 'medium' || b.size === 'large') {
    return `wall:landmark:${ti}`;
  }
  return `wall:standard:${ti}`;
}

/**
 * Determine floor texture key for a building.
 */
export function floorTextureKey(bi, buildings) {
  if (bi < 0) return 'floor:building:0';
  const ti = getTexGroup(bi, buildings);
  return `floor:building:${ti}`;
}

// ─── Edge gap detection ───────────────────────────────────────────────

/**
 * Find gaps along one edge of a section where no adjacent section covers it.
 * Returns array of {start, end} intervals in the run axis.
 */
export function getEdgeGaps(section, side, allSections) {
  const margin = 0.1;
  let runMin, runMax;

  if (side === 'north' || side === 'south') {
    runMin = section.x;
    runMax = section.x + section.w;
  } else {
    runMin = section.z;
    runMax = section.z + section.d;
  }

  // Collect coverage intervals from adjacent sections
  const covered = [];
  for (const other of allSections) {
    if (other === section) continue;
    let adjacent = false;
    let covMin, covMax;

    if (side === 'north') {
      adjacent = Math.abs(other.z + other.d - section.z) < margin &&
                 other.x < section.x + section.w + margin && other.x + other.w > section.x - margin;
      covMin = Math.max(section.x, other.x);
      covMax = Math.min(section.x + section.w, other.x + other.w);
    } else if (side === 'south') {
      adjacent = Math.abs(other.z - (section.z + section.d)) < margin &&
                 other.x < section.x + section.w + margin && other.x + other.w > section.x - margin;
      covMin = Math.max(section.x, other.x);
      covMax = Math.min(section.x + section.w, other.x + other.w);
    } else if (side === 'west') {
      adjacent = Math.abs(other.x + other.w - section.x) < margin &&
                 other.z < section.z + section.d + margin && other.z + other.d > section.z - margin;
      covMin = Math.max(section.z, other.z);
      covMax = Math.min(section.z + section.d, other.z + other.d);
    } else { // east
      adjacent = Math.abs(other.x - (section.x + section.w)) < margin &&
                 other.z < section.z + section.d + margin && other.z + other.d > section.z - margin;
      covMin = Math.max(section.z, other.z);
      covMax = Math.min(section.z + section.d, other.z + other.d);
    }

    if (adjacent && covMax > covMin) {
      covered.push({ start: covMin, end: covMax });
    }
  }

  // Sort and merge
  covered.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const c of covered) {
    if (merged.length > 0 && c.start <= merged[merged.length - 1].end + margin) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, c.end);
    } else {
      merged.push({ ...c });
    }
  }

  // Find gaps (uncovered intervals)
  const gaps = [];
  let cursor = runMin;
  for (const c of merged) {
    if (c.start > cursor + margin) {
      gaps.push({ start: cursor, end: c.start });
    }
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < runMax - margin) {
    gaps.push({ start: cursor, end: runMax });
  }

  return gaps;
}

// ─── Bridge gap detection ─────────────────────────────────────────────

/**
 * Find gap intervals along a bridge wall where branches connect.
 * Returns merged gap intervals along the wall's run axis.
 */
export function findBranchGaps(bridge, wallAxis, wallStart, wallEnd, fixedPos, allBranches) {
  const gaps = [];
  for (const br of allBranches) {
    // Must be at similar Y and perpendicular
    if (Math.abs(br.y - bridge.y) > 0.5) continue;
    if (br.axis === bridge.axis) continue;

    let brMin, brMax;
    if (wallAxis === 'x') {
      // Wall runs along X; branch crosses in Z
      const brZ1 = br.z, brZ2 = br.z + br.d;
      if (fixedPos < brZ1 - 0.5 || fixedPos > brZ2 + 0.5) continue;
      brMin = br.x;
      brMax = br.x + br.w;
    } else {
      // Wall runs along Z; branch crosses in X
      const brX1 = br.x, brX2 = br.x + br.w;
      if (fixedPos < brX1 - 0.5 || fixedPos > brX2 + 0.5) continue;
      brMin = br.z;
      brMax = br.z + br.d;
    }

    const margin = 0.25;
    const gapStart = Math.max(wallStart, brMin - margin);
    const gapEnd = Math.min(wallEnd, brMax + margin);
    if (gapEnd > gapStart) gaps.push({ start: gapStart, end: gapEnd });
  }

  // Sort and merge overlapping
  gaps.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const g of gaps) {
    if (merged.length > 0 && g.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, g.end);
    } else {
      merged.push({ ...g });
    }
  }
  return merged;
}

/**
 * Split a wall span into segments with gaps removed.
 * Returns array of {start, end} for surviving wall segments.
 */
export function splitWallSegments(wallStart, wallEnd, gaps) {
  const segments = [];
  let cursor = wallStart;
  for (const g of gaps) {
    if (g.start > cursor) segments.push({ start: cursor, end: g.start });
    cursor = g.end;
  }
  if (cursor < wallEnd) segments.push({ start: cursor, end: wallEnd });
  return segments.filter(s => (s.end - s.start) >= 0.1);
}
