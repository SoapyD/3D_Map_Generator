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

import { buildFloorPrimitives } from './build-floor-primitives.js';
import { buildWallPrimitives } from './build-wall-primitives.js';
import { buildWalkwayPrimitives } from './build-walkway-primitives.js';
import { buildPillarPrimitives } from './build-pillar-primitives.js';
import { buildRoofPrimitives } from './build-roof-primitives.js';
import { buildAllLadderPrimitives } from './build-all-ladder-primitives.js';
import { buildLadderPlatformPrimitives } from './build-ladder-platform-primitives.js';
import { buildJunctionPlatformPrimitives } from './build-junction-platform-primitives.js';
import { buildBridgePrimitives } from './build-bridge-primitives.js';
import { buildBoxSlabPrimitives } from './build-scatter-primitives.js';
import { buildCourtyardPrimitives } from './build-courtyard-primitives.js';
import { buildBuildingFootprintPrimitives } from './build-building-footprint-primitives.js';

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
  const floorData = data.floors || [];
  const walls = data.walls || [];
  const walkways = data.connections ? data.connections.walkways : [];
  const bridges = data.connections ? data.connections.bridges || [] : [];
  const pillars = data.connections ? data.connections.pillars || [] : [];

  if (floorData.length > 0) {
    primitives.push(...buildFloorPrimitives(floorData, buildings, config));
  } else {
    primitives.push(...buildBuildingFootprintPrimitives(buildings, config));
  }
  primitives.push(...buildWallPrimitives(walls, buildings));
  primitives.push(...buildWalkwayPrimitives(walkways));

  const allBranches = [...walkways.filter(w => w.branch), ...bridges.filter(b => b.branch)];
  primitives.push(...buildBridgePrimitives(bridges, walkways, allBranches));
  primitives.push(...buildPillarPrimitives(pillars, bridges, walkways));

  const objTexKey = (i) => `object:${i}`;
  primitives.push(...buildBoxSlabPrimitives(data.cover || [], 'cover', objTexKey));
  primitives.push(...buildBoxSlabPrimitives(data.interiorCover || [], 'interior_cover', objTexKey));
  primitives.push(...buildBoxSlabPrimitives(data.streetScatter || [], 'street_scatter', objTexKey));
  primitives.push(...buildCourtyardPrimitives(data.deletedFootprints || []));
  primitives.push(...buildRoofPrimitives(data.roofs || [], buildings, config));

  const conn = data.connections || {};
  primitives.push(...buildAllLadderPrimitives(conn, walls));
  primitives.push(...buildLadderPlatformPrimitives(conn.ladderPlatforms || []));
  primitives.push(...buildJunctionPlatformPrimitives(conn.junctionPlatforms || []));

  return { version: 1, primitives };
}
