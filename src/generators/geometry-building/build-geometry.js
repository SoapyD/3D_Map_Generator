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

import { GEOMETRY } from '../../config.js';
import { findBuilding, findBuildingForWall } from '../find/index.js';
import { wallTextureKey } from '../wall-texture-key.js';
import { floorTextureKey } from '../floor-texture-key.js';
import { getEdgeGaps } from '../get/index.js';
import { buildRoofPrimitives } from './build-roof-primitives.js';
import { buildAllLadderPrimitives } from './build-all-ladder-primitives.js';
import { buildLadderPlatformPrimitives } from './build-ladder-platform-primitives.js';
import { buildJunctionPlatformPrimitives } from './build-junction-platform-primitives.js';
import { buildBridgePrimitives } from './build-bridge-primitives.js';
import { buildBoxSlabPrimitives } from './build-scatter-primitives.js';
import { buildCourtyardPrimitives } from './build-courtyard-primitives.js';

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
  const allBranches = [
    ...walkways.filter(w => w.branch),
    ...bridges.filter(b => b.branch),
  ];
  primitives.push(...buildBridgePrimitives(bridges, walkways, allBranches));

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

  // ─── Cover / Interior Cover / Street Scatter ──────────────────────

  const objTexKey = (i) => `object:${i}`;
  primitives.push(...buildBoxSlabPrimitives(data.cover || [], 'cover', objTexKey));
  primitives.push(...buildBoxSlabPrimitives(data.interiorCover || [], 'interior_cover', objTexKey));
  primitives.push(...buildBoxSlabPrimitives(data.streetScatter || [], 'street_scatter', objTexKey));

  // ─── Deleted Footprints (Courtyards) ──────────────────────────────

  primitives.push(...buildCourtyardPrimitives(data.deletedFootprints || []));

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
