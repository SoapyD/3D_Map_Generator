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

import { GEOMETRY, CONNECTIVITY } from '../../config.js';
import {
  findBuilding,
  findBuildingForWall,
  wallTextureKey,
  floorTextureKey,
  getEdgeGaps,
  findBranchGaps,
  splitWallSegments,
} from '../geometry-helpers.js';
import { buildRoofPrimitives } from './build-roof-primitives.js';
import { buildAllLadderPrimitives } from './build-all-ladder-primitives.js';
import { buildLadderPlatformPrimitives } from './build-ladder-platform-primitives.js';
import { buildJunctionPlatformPrimitives } from './build-junction-platform-primitives.js';

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
  primitives.push(...buildRoofPrimitives(roofEntries, buildings, config));

  // ─── Ladders ──────────────────────────────────────────────────────

  const conn = data.connections || {};
  primitives.push(...buildAllLadderPrimitives(conn, walls));

  // ─── Ladder Platforms ─────────────────────────────────────────────

  const ladderPlatforms = conn.ladderPlatforms || [];
  primitives.push(...buildLadderPlatformPrimitives(ladderPlatforms));

  // ─── Junction Platforms ───────────────────────────────────────────

  const junctionPlatforms = conn.junctionPlatforms || [];
  primitives.push(...buildJunctionPlatformPrimitives(junctionPlatforms));

  return { version: 1, primitives };
}
