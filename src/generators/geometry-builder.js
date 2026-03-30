/**
 * Geometry Builder — shared geometry description layer.
 *
 * Converts pipeline data into an array of renderer-agnostic primitives.
 * Each primitive describes WHAT to render (position, size, texture key)
 * without knowing HOW (Three.js meshes vs OBJ vertices).
 *
 * The output can be serialised as a handover file (_geometry.json)
 * and consumed by scene-builder.js (GLB), obj-exporter.js (OBJ),
 * and collision-exporter.js independently.
 */

import { GEOMETRY, CONNECTIVITY } from '../config.js';

/**
 * Find which building a floor section belongs to.
 */
function findBuilding(x, z, w, d, buildings) {
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
function findBuildingForWall(wall, buildings) {
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
function getTexGroup(bi, buildings) {
  if (bi < 0 || bi >= buildings.length) return bi;
  const b = buildings[bi];
  return b.textureGroup !== undefined ? b.textureGroup : bi;
}

/**
 * Determine wall texture category based on building size.
 */
function wallTextureKey(bi, buildings) {
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
function floorTextureKey(bi, buildings) {
  if (bi < 0) return 'floor:building:0';
  const ti = getTexGroup(bi, buildings);
  return `floor:building:${ti}`;
}

// ─── Edge gap detection ───────────────────────────────────────────────

/**
 * Find gaps along one edge of a section where no adjacent section covers it.
 * Returns array of {start, end} intervals in the run axis.
 */
function getEdgeGaps(section, side, allSections) {
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
function findBranchGaps(bridge, wallAxis, wallStart, wallEnd, fixedPos, allBranches) {
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
function splitWallSegments(wallStart, wallEnd, gaps) {
  const segments = [];
  let cursor = wallStart;
  for (const g of gaps) {
    if (g.start > cursor) segments.push({ start: cursor, end: g.start });
    cursor = g.end;
  }
  if (cursor < wallEnd) segments.push({ start: cursor, end: wallEnd });
  return segments.filter(s => (s.end - s.start) >= 0.1);
}

// ─── Main builder ─────────────────────────────────────────────────────

/**
 * Build renderer-agnostic geometry primitives from pipeline data.
 *
 * @param {object} data - Pipeline data (coverData from generation stages)
 * @param {object} config - Generation config
 * @returns {{ version: number, primitives: object[] }}
 */
export function buildGeometry(data, config) {
  const primitives = [];
  const buildings = data.buildings || [];

  // ─── Floors ───────────────────────────────────────────────────────

  const floorData = data.floors || [];

  // Base floor (tier 0)
  if (floorData.length > 0 && floorData[0].sections.length > 0) {
    const base = floorData[0].sections[0];
    primitives.push({
      type: 'slab', name: 'base_floor',
      x: base.x, y: 0, z: base.z, w: base.w, h: config.slabThickness, d: base.d,
      textureKey: 'floor:base:0',
      emitTop: true, emitBottom: true, simpleBottom: true, rotateUV: false,
      shared: true,
    });
    const edgeGaps = {};
    for (const side of ['north', 'south', 'west', 'east']) {
      edgeGaps[side] = getEdgeGaps(base, side, [base]);
    }
    primitives.push({
      type: 'edges', name: 'base_floor',
      x: base.x, y: 0, z: base.z, w: base.w, h: config.slabThickness, d: base.d,
      textureKey: 'floor:base:0', edgeGaps,
    });
  }

  // Building floors (tier 1+)
  for (let t = 1; t < floorData.length; t++) {
    const tier = floorData[t];
    const y = tier.tier * config.tierHeight;
    for (const section of tier.sections) {
      const bi = findBuilding(section.x, section.z, section.w, section.d, buildings);
      const texKey = bi >= 0 ? floorTextureKey(bi, buildings) : 'floor:base:0';
      const name = `floor_t${tier.tier}_${Math.round(section.x)}_${Math.round(section.z)}`;

      primitives.push({
        type: 'slab', name,
        x: section.x, y, z: section.z, w: section.w, h: config.slabThickness, d: section.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
        shared: true,
      });

      const edgeGaps = {};
      for (const side of ['north', 'south', 'west', 'east']) {
        edgeGaps[side] = getEdgeGaps(section, side, tier.sections);
      }
      primitives.push({
        type: 'edges', name,
        x: section.x, y, z: section.z, w: section.w, h: config.slabThickness, d: section.d,
        textureKey: texKey, edgeGaps,
      });
    }
  }

  // ─── Walls ────────────────────────────────────────────────────────

  const walls = data.walls || [];
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const bi = findBuildingForWall(wall, buildings);
    const texKey = wallTextureKey(bi, buildings);
    const wx = wall.axis === 'x' ? wall.length : wall.thickness;
    const wz = wall.axis === 'z' ? wall.length : wall.thickness;

    primitives.push({
      type: 'wall', name: `wall_${i}`,
      x: wall.x, y: wall.baseY, z: wall.z, w: wx, h: wall.height, d: wz,
      textureKey: texKey,
      axis: wall.axis,
    });
  }

  // ─── Walkways ─────────────────────────────────────────────────────

  const walkways = data.connections ? data.connections.walkways : [];
  for (let i = 0; i < walkways.length; i++) {
    const w = walkways[i];
    const texIdx = (w.textureId !== undefined && w.branch)
      ? walkways.findIndex(ww => ww.textureId === w.textureId && !ww.branch)
      : i;
    const name = w.blocked ? `walkway_BLOCKED_${i}` : `walkway_${i}`;

    primitives.push({
      type: 'slab', name,
      x: w.x, y: w.y, z: w.z, w: w.w, h: GEOMETRY.walkwayThickness, d: w.d,
      textureKey: `walkway:${texIdx >= 0 ? texIdx : i}`,
      emitTop: true, emitBottom: true, simpleBottom: false,
      rotateUV: w.w > w.d,
      shared: true,
    });
    primitives.push({
      type: 'edges', name,
      x: w.x, y: w.y, z: w.z, w: w.w, h: GEOMETRY.walkwayThickness, d: w.d,
      textureKey: `walkway:${texIdx >= 0 ? texIdx : i}`,
    });
  }

  // ─── Bridges ──────────────────────────────────────────────────────

  const bridges = data.connections ? data.connections.bridges || [] : [];

  // Collect all branches for gap detection
  const allBranches = [
    ...walkways.filter(w => w.branch),
    ...bridges.filter(b => b.branch),
  ];

  const bridgeThickness = CONNECTIVITY.bridgeThickness || 0.5;
  const wallH = CONNECTIVITY.bridgeWallHeight || 0.75;
  const wallT = CONNECTIVITY.bridgeWallThickness || 0.25;

  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];

    // Bridge texture — branches use parent's texture via textureId
    const bridgeTexIdx = (b.textureId !== undefined)
      ? bridges.findIndex(br => br.textureId === b.textureId && !br.branch)
      : i;
    const texKey = `wall:landmark:${bridgeTexIdx >= 0 ? bridgeTexIdx : i}`;

    // Bridge slab
    primitives.push({
      type: 'slab', name: `bridge_${i}`,
      x: b.x, y: b.y, z: b.z, w: b.w, h: bridgeThickness, d: b.d,
      textureKey: texKey,
      emitTop: true, emitBottom: true, simpleBottom: false,
      rotateUV: b.w > b.d,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `bridge_${i}`,
      x: b.x, y: b.y, z: b.z, w: b.w, h: bridgeThickness, d: b.d,
      textureKey: texKey,
    });

    // Side walls with gap detection
    const wallY = b.y + bridgeThickness;

    function emitWallSegments(side, wallAxis, wallStart, wallEnd, fixedPos, isXWall) {
      const gaps = findBranchGaps(b, wallAxis, wallStart, wallEnd, fixedPos, allBranches);
      const segments = splitWallSegments(wallStart, wallEnd, gaps);

      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        const segLen = seg.end - seg.start;
        let sx, sz, sw, sd;
        if (isXWall) {
          sx = seg.start; sz = fixedPos - wallT / 2; sw = segLen; sd = wallT;
        } else {
          sx = fixedPos - wallT / 2; sz = seg.start; sw = wallT; sd = segLen;
        }

        primitives.push({
          type: 'slab', name: `bridge_wall_${i}_${side}_seg${si}`,
          x: sx, y: wallY, z: sz, w: sw, h: wallH, d: sd,
          textureKey: texKey,
          emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
          shared: false,
          thinAxis: isXWall ? 'z' : 'x',
        });
      }

      return segments;
    }

    let segmentsL, segmentsR;
    if (b.axis === 'x') {
      segmentsL = emitWallSegments('L', 'x', b.x, b.x + b.w, b.z + wallT / 2, true);
      segmentsR = emitWallSegments('R', 'x', b.x, b.x + b.w, b.z + b.d - wallT / 2, true);
    } else {
      segmentsL = emitWallSegments('L', 'z', b.z, b.z + b.d, b.x + wallT / 2, false);
      segmentsR = emitWallSegments('R', 'z', b.z, b.z + b.d, b.x + b.w - wallT / 2, false);
    }

    // Battlements — only within surviving wall segments
    if (b.variant === 'battlement') {
      const battH = CONNECTIVITY.bridgeBattlementHeight - wallH;
      const spacing = CONNECTIVITY.bridgeBattlementSpacing || 2.25;
      const gap = CONNECTIVITY.bridgeBattlementGap || 1.5;
      const pillarW = spacing - gap;
      const battY = wallY + wallH;

      function emitBattlements(segments, fixedPos, isXWall, side) {
        for (const seg of segments) {
          const segStart = seg.start;
          const segLen = seg.end - seg.start;
          for (let pos = 0; pos < segLen - pillarW; pos += spacing) {
            let bx, bz, bw, bd;
            if (isXWall) {
              bx = segStart + pos; bz = fixedPos - wallT / 2; bw = pillarW; bd = wallT;
            } else {
              bx = fixedPos - wallT / 2; bz = segStart + pos; bw = wallT; bd = pillarW;
            }

            primitives.push({
              type: 'slab', name: `bridge_batt_${i}_${side}_${Math.round(segStart + pos)}`,
              x: bx, y: battY, z: bz, w: bw, h: battH, d: bd,
              textureKey: texKey,
              emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
              shared: false,
              thinAxis: isXWall ? 'z' : 'x',
            });
          }
        }
      }

      if (b.axis === 'x') {
        emitBattlements(segmentsL, b.z + wallT / 2, true, 'L');
        emitBattlements(segmentsR, b.z + b.d - wallT / 2, true, 'R');
      } else {
        emitBattlements(segmentsL, b.x + wallT / 2, false, 'L');
        emitBattlements(segmentsR, b.x + b.w - wallT / 2, false, 'R');
      }
    }
  }

  // ─── Pillars ──────────────────────────────────────────────────────

  const pillars = data.connections ? data.connections.pillars || [] : [];
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    let texKey;
    if (p.isBridge) {
      const parentIdx = bridges.findIndex(b => b.textureId === p.textureId && !b.branch);
      texKey = `wall:landmark:${parentIdx >= 0 ? parentIdx : i}`;
    } else {
      const parentIdx = walkways.findIndex(w => w.textureId === p.textureId && !w.branch);
      texKey = `walkway:${parentIdx >= 0 ? parentIdx : i}`;
    }

    primitives.push({
      type: 'slab', name: `pillar_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: p.height, d: p.d,
      textureKey: texKey,
      emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: false,
    });
  }

  // ─── Cover ────────────────────────────────────────────────────────

  const cover = data.cover || [];
  for (let i = 0; i < cover.length; i++) {
    const c = cover[i];
    primitives.push({
      type: 'slab', name: `cover_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `cover_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
    });
  }

  // ─── Interior Cover ───────────────────────────────────────────────

  const interiorCover = data.interiorCover || [];
  for (let i = 0; i < interiorCover.length; i++) {
    const c = interiorCover[i];
    primitives.push({
      type: 'slab', name: `interior_cover_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `interior_cover_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
    });
  }

  // ─── Deleted Footprints (Courtyards) ──────────────────────────────

  const deletedFootprints = data.deletedFootprints || [];
  for (let i = 0; i < deletedFootprints.length; i++) {
    const df = deletedFootprints[i];
    primitives.push({
      type: 'slab', name: `deleted_${i}`,
      x: df.x, y: GEOMETRY.courtyardY, z: df.z, w: df.w, h: GEOMETRY.courtyardThickness, d: df.d,
      textureKey: 'courtyard',
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `deleted_${i}`,
      x: df.x, y: GEOMETRY.courtyardY, z: df.z, w: df.w, h: GEOMETRY.courtyardThickness, d: df.d,
      textureKey: 'courtyard',
    });
  }

  // ─── Street Scatter ───────────────────────────────────────────────

  const streetScatter = data.streetScatter || [];
  for (let i = 0; i < streetScatter.length; i++) {
    const c = streetScatter[i];
    primitives.push({
      type: 'slab', name: `street_scatter_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
      emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `street_scatter_${i}`,
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.height, d: c.d,
      textureKey: `object:${i}`,
    });
  }

  // ─── Roofs ────────────────────────────────────────────────────────

  const roofEntries = data.roofs || [];
  for (let ri = 0; ri < roofEntries.length; ri++) {
    const roof = roofEntries[ri];
    const roofTexKey = `roof:${getTexGroup(roof.buildingIndex, buildings)}`;
    const ceilingTexKey = floorTextureKey(roof.buildingIndex, buildings);

    if (roof.type === 'flat') {
      const ry = roof.tier * config.tierHeight;
      const rs = roof.section;

      // Top face — roof texture
      primitives.push({
        type: 'slab', name: `roof_flat_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
        emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
        shared: true,
      });
      // Bottom face — ceiling texture
      primitives.push({
        type: 'ceiling', name: `roof_ceil_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: ceilingTexKey,
        shared: true,
      });
      // Edges
      primitives.push({
        type: 'edges', name: `roof_flat_${ri}`,
        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
        textureKey: roofTexKey,
      });
    } else if (roof.type === 'pyramid') {
      const b = roof.building;
      const topY = roof.tier * config.tierHeight;
      const apexY = topY + Math.min(b.w, b.d) * 0.6;
      const cx = b.x + b.w / 2;
      const cz = b.z + b.d / 2;

      // 4 sloped triangle faces
      const faces = [
        { name: 'N', verts: [[b.x + b.w, topY, b.z], [b.x, topY, b.z], [cx, apexY, cz]] },
        { name: 'E', verts: [[b.x + b.w, topY, b.z + b.d], [b.x + b.w, topY, b.z], [cx, apexY, cz]] },
        { name: 'S', verts: [[b.x, topY, b.z + b.d], [b.x + b.w, topY, b.z + b.d], [cx, apexY, cz]] },
        { name: 'W', verts: [[b.x, topY, b.z], [b.x, topY, b.z + b.d], [cx, apexY, cz]] },
      ];
      for (const face of faces) {
        primitives.push({
          type: 'quad', name: `roof_pyramid_${ri}_${face.name}`,
          verts: face.verts,
          textureKey: roofTexKey,
        });
      }

      // Flat ceiling under pyramid
      primitives.push({
        type: 'ceiling', name: `roof_pyramid_ceil_${ri}`,
        x: b.x, y: topY, z: b.z, w: b.w, h: 0, d: b.d,
        textureKey: ceilingTexKey,
        shared: true,
      });
    }
  }

  // ─── Ladders ──────────────────────────────────────────────────────

  const conn = data.connections || {};

  function buildLadderPrimitive(name, l, texIdx) {
    const height = l.y1 - l.y0;
    if (height <= 0) return null;

    const isThinX = l.w < l.d;
    const ladderWidth = isThinX ? l.d : l.w;
    const cx = l.x + l.w / 2;
    const cz = l.z + l.d / 2;
    const halfSpread = (ladderWidth / 2) - GEOMETRY.ladderPoleWidth / 2 - GEOMETRY.ladderRungInset;

    // Calculate pole positions
    const poles = [];
    const rungs = [];

    if (isThinX) {
      poles.push({ x: cx, z: cz - halfSpread - GEOMETRY.ladderPoleWidth / 2, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
      poles.push({ x: cx, z: cz + halfSpread - GEOMETRY.ladderPoleWidth / 2, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
    } else {
      poles.push({ x: cx - halfSpread - GEOMETRY.ladderPoleWidth / 2, z: cz, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
      poles.push({ x: cx + halfSpread - GEOMETRY.ladderPoleWidth / 2, z: cz, y0: l.y0, y1: l.y1, w: GEOMETRY.ladderPoleWidth, d: GEOMETRY.ladderPoleDepth });
    }

    const rungCount = Math.floor(height / GEOMETRY.ladderRungSpacing);
    for (let r = 1; r <= rungCount; r++) {
      const ry = l.y0 + r * GEOMETRY.ladderRungSpacing;
      if (ry >= l.y1 - GEOMETRY.ladderRungSpacing * 0.3) break;
      const rungLen = halfSpread * 2 + GEOMETRY.ladderPoleWidth;

      if (isThinX) {
        rungs.push({ x: cx, y: ry, z: cz - halfSpread - GEOMETRY.ladderPoleWidth / 2, w: GEOMETRY.ladderRungDepth, h: GEOMETRY.ladderRungHeight, d: rungLen });
      } else {
        rungs.push({ x: cx - halfSpread - GEOMETRY.ladderPoleWidth / 2, y: ry, z: cz, w: rungLen, h: GEOMETRY.ladderRungHeight, d: GEOMETRY.ladderRungDepth });
      }
    }

    // Detect wall offset direction (for OBJ flat mode)
    let wallOffsetDir = 1;
    let nearestWallDist = Infinity;
    for (const wall of walls) {
      const wx1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
      const wz1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
      if (isThinX) {
        if (cz >= wall.z - 0.5 && cz <= wz1 + 0.5) {
          const wallCx = (wall.x + wx1) / 2;
          const dist = Math.abs(wallCx - cx);
          if (dist < nearestWallDist) {
            nearestWallDist = dist;
            wallOffsetDir = (cx >= wallCx) ? 1 : -1;
          }
        }
      } else {
        if (cx >= wall.x - 0.5 && cx <= wx1 + 0.5) {
          const wallCz = (wall.z + wz1) / 2;
          const dist = Math.abs(wallCz - cz);
          if (dist < nearestWallDist) {
            nearestWallDist = dist;
            wallOffsetDir = (cz >= wallCz) ? 1 : -1;
          }
        }
      }
    }

    return {
      type: 'ladder', name,
      x: l.x, y0: l.y0, y1: l.y1, z: l.z, w: l.w, d: l.d,
      poles, rungs,
      isThinX, wallOffsetDir,
      textureKey: `ladder:${texIdx}`,
    };
  }

  // Yellow ladders
  const ladders = conn.ladders || [];
  for (let i = 0; i < ladders.length; i++) {
    const p = buildLadderPrimitive(`ladder_${i}`, ladders[i], i);
    if (p) primitives.push(p);
  }

  // Ground ladders
  const groundLadders = conn.groundLadders || [];
  for (let i = 0; i < groundLadders.length; i++) {
    const p = buildLadderPrimitive(`ground_ladder_${i}`, groundLadders[i], i + 10);
    if (p) primitives.push(p);
  }

  // Orange ladders
  const orangeLadders = conn.orangeLadders || [];
  for (let i = 0; i < orangeLadders.length; i++) {
    const l = orangeLadders[i];
    const name = l.bad ? `orange_ladder_BAD_${i}` : `orange_ladder_${i}`;
    const p = buildLadderPrimitive(name, l, i + 20);
    if (p) primitives.push(p);
  }

  // Interior ladders
  const interiorLadders = conn.interiorLadders || [];
  for (let i = 0; i < interiorLadders.length; i++) {
    const p = buildLadderPrimitive(`interior_ladder_${i}`, interiorLadders[i], i + 30);
    if (p) primitives.push(p);
  }

  // ─── Ladder Platforms ─────────────────────────────────────────────

  const ladderPlatforms = conn.ladderPlatforms || [];
  for (let i = 0; i < ladderPlatforms.length; i++) {
    const p = ladderPlatforms[i];
    primitives.push({
      type: 'slab', name: `ladder_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex}`,
      emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `ladder_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex}`,
    });
  }

  // ─── Junction Platforms ───────────────────────────────────────────

  const junctionPlatforms = conn.junctionPlatforms || [];
  for (let i = 0; i < junctionPlatforms.length; i++) {
    const p = junctionPlatforms[i];
    primitives.push({
      type: 'slab', name: `junction_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex || 0}`,
      emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
      shared: true,
    });
    primitives.push({
      type: 'edges', name: `junction_platform_${i}`,
      x: p.x, y: p.y, z: p.z, w: p.w, h: GEOMETRY.platformThickness, d: p.d,
      textureKey: `walkway:${p.ladderIndex || 0}`,
    });
  }

  return { version: 1, primitives };
}
