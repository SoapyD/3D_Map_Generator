/**
 * Scene Builder — converts geometry primitives into a Three.js scene.
 *
 * Consumes the handover primitives produced by geometry-builder.js.
 * Only handles HOW to render (Three.js meshes, materials), not WHAT.
 */

import * as THREE from 'three';
import { createSlab, createLadderMesh } from '../core/geometry-misc.js';
import { createFloorSlab } from '../core/geometry-rects.js';
import { buildTexturePools, pickFromPool } from './textures.js';
import { LADDER_DISPLAY, GEOMETRY } from '../config.js';

// Debug materials (flat colours)
const DEBUG_MATERIALS = {
  base: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }),
  floor: [
    new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x7a6848, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x6b5c3e, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x5c5034, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x4d442a, roughness: 0.8 }),
  ],
  wall: new THREE.MeshStandardMaterial({ color: 0x9b8b75, roughness: 0.85 }),
  ladder: new THREE.MeshStandardMaterial({ color: 0xcccc22, roughness: 0.7 }),
  walkway: new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.7 }),
  ramp: new THREE.MeshStandardMaterial({ color: 0x44aa44, roughness: 0.7 }),
  groundLadder: new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 }),
  orangeLadder: new THREE.MeshStandardMaterial({ color: 0xee8822, roughness: 0.7 }),
  cover: new THREE.MeshStandardMaterial({ color: 0x8844cc, roughness: 0.7 }),
  interiorCover: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 }),
  deletedFootprint: new THREE.MeshStandardMaterial({ color: 0xff66aa, roughness: 0.7 }),
  badLadder: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),
  interiorLadder: new THREE.MeshStandardMaterial({ color: 0x22cccc, roughness: 0.7 }),
  ladderPlatform: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 }),
  streetScatter: new THREE.MeshStandardMaterial({ color: 0x22ee44, roughness: 0.7 }),
  pillar: new THREE.MeshStandardMaterial({ color: 0x666644, roughness: 0.9 }),
};

/**
 * Resolve a textureKey string to a debug material.
 */
function resolveDebugMaterial(name) {
  if (name === 'base_floor') return DEBUG_MATERIALS.base;
  if (name.startsWith('floor_t')) {
    const tier = parseInt(name.split('_')[1].replace('t', ''), 10);
    return tier === 0 ? DEBUG_MATERIALS.base : DEBUG_MATERIALS.floor[Math.min(tier - 1, DEBUG_MATERIALS.floor.length - 1)];
  }
  if (name.startsWith('wall_')) return DEBUG_MATERIALS.wall;
  if (name.startsWith('walkway_BLOCKED_')) return DEBUG_MATERIALS.ramp;
  if (name.startsWith('walkway_')) return DEBUG_MATERIALS.walkway;
  if (name.startsWith('bridge_')) return DEBUG_MATERIALS.walkway;
  if (name.startsWith('pillar_')) return DEBUG_MATERIALS.pillar;
  if (name.startsWith('cover_')) return DEBUG_MATERIALS.cover;
  if (name.startsWith('interior_cover_')) return DEBUG_MATERIALS.interiorCover;
  if (name.startsWith('deleted_')) return DEBUG_MATERIALS.deletedFootprint;
  if (name.startsWith('street_scatter_')) return DEBUG_MATERIALS.streetScatter;
  if (name.startsWith('roof_')) return DEBUG_MATERIALS.floor[0];
  if (name.startsWith('ladder_platform_') || name.startsWith('junction_platform_')) return DEBUG_MATERIALS.ladderPlatform;
  if (name.startsWith('ground_ladder_')) return DEBUG_MATERIALS.groundLadder;
  if (name.startsWith('orange_ladder_BAD_')) return DEBUG_MATERIALS.badLadder;
  if (name.startsWith('orange_ladder_')) return DEBUG_MATERIALS.orangeLadder;
  if (name.startsWith('interior_ladder_')) return DEBUG_MATERIALS.interiorLadder;
  if (name.startsWith('ladder_')) return DEBUG_MATERIALS.ladder;
  return DEBUG_MATERIALS.wall;
}

/**
 * Resolve a textureKey string to a material from texture pools.
 *
 * Key format: "category:index" or "category:subcategory:index"
 *   floor:base:0        → pools.base_map[0]
 *   floor:building:2    → pools.floors[2]
 *   wall:standard:1     → pools.walls[1]
 *   wall:landmark:0     → pools.landmark_walls[0]
 *   walkway:5           → pools.walkways[5]
 *   roof:3              → pools.roofs[3]
 *   object:5            → pools.objects[5]
 *   courtyard           → pools.courtyards[0]
 *   ladder:0            → pools.ladders[0]
 */
function resolveTexturedMaterial(textureKey, pools) {
  const parts = textureKey.split(':');

  if (parts[0] === 'floor') {
    if (parts[1] === 'base') return pickFromPool(pools.base_map, parseInt(parts[2], 10));
    return pickFromPool(pools.floors, parseInt(parts[2], 10));
  }
  if (parts[0] === 'wall') {
    if (parts[1] === 'landmark') return pickFromPool(pools.landmark_walls, parseInt(parts[2], 10));
    return pickFromPool(pools.walls, parseInt(parts[2], 10));
  }
  if (parts[0] === 'walkway') return pickFromPool(pools.walkways, parseInt(parts[1], 10));
  if (parts[0] === 'roof') return pickFromPool(pools.roofs, parseInt(parts[1], 10));
  if (parts[0] === 'object') return pickFromPool(pools.objects, parseInt(parts[1], 10));
  if (parts[0] === 'courtyard') return pickFromPool(pools.courtyards, 0);
  if (parts[0] === 'ladder') return pickFromPool(pools.ladders, parseInt(parts[1], 10));

  return pickFromPool(pools.walls, 0);
}

/**
 * Build a Three.js scene from geometry primitives.
 *
 * @param {{ version: number, primitives: object[] }} geometry - From buildGeometry()
 * @param {object} config - Generation config
 * @returns {THREE.Scene}
 */
export function buildScene(geometry, config) {
  const scene = new THREE.Scene();
  const debug = config.debug;

  let pools = null;
  if (!debug) {
    pools = buildTexturePools(config.textureSet || 'base');
  }

  function getMaterial(prim) {
    if (debug) return resolveDebugMaterial(prim.name);
    return resolveTexturedMaterial(prim.textureKey, pools);
  }

  const ladderOpts = {
    poleRadius: LADDER_DISPLAY.poleRadius,
    rungRadius: LADDER_DISPLAY.rungRadius,
    rungSpacing: LADDER_DISPLAY.rungSpacing,
    rungInset: LADDER_DISPLAY.rungInset,
  };

  for (const prim of geometry.primitives) {
    switch (prim.type) {
      case 'slab': {
        const mat = getMaterial(prim);
        const mesh = createSlab(
          prim.x + prim.w / 2,
          prim.y + prim.h / 2,
          prim.z + prim.d / 2,
          prim.w, prim.h, prim.d,
          mat,
          { rotateUV: prim.rotateUV || false },
        );
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'wall': {
        const mat = getMaterial(prim);
        const mesh = createSlab(
          prim.x + prim.w / 2,
          prim.y + prim.h / 2,
          prim.z + prim.d / 2,
          prim.w, prim.h, prim.d,
          mat,
        );
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'quad': {
        // Triangular faces (pyramid roofs)
        const mat = getMaterial(prim);
        const verts = prim.verts;
        const positions = new Float32Array(verts.length * 3);
        for (let i = 0; i < verts.length; i++) {
          positions[i * 3] = verts[i][0];
          positions[i * 3 + 1] = verts[i][1];
          positions[i * 3 + 2] = verts[i][2];
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'ceiling': {
        // Downward-facing flat quad
        const mat = getMaterial(prim);
        const positions = new Float32Array([
          prim.x, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z + prim.d,
          prim.x, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z + prim.d,
          prim.x, prim.y, prim.z + prim.d,
        ]);
        const normals = new Float32Array([
          0, -1, 0, 0, -1, 0, 0, -1, 0,
          0, -1, 0, 0, -1, 0, 0, -1, 0,
        ]);
        const uvs = new Float32Array([
          0, 0, 1, 0, 1, 1,
          0, 0, 1, 1, 0, 1,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'ladder': {
        const mat = getMaterial(prim);

        // Box ladder (debug)
        if (LADDER_DISPLAY.showBoxLadders) {
          const height = prim.y1 - prim.y0;
          const box = createSlab(
            prim.x + prim.w / 2, prim.y0 + height / 2, prim.z + prim.d / 2,
            prim.w, height, prim.d, mat,
          );
          box.name = prim.name + '_box';
          scene.add(box);
        }

        // Mesh ladder (poles + rungs)
        if (LADDER_DISPLAY.showMeshLadders) {
          const ladderData = { x: prim.x, z: prim.z, w: prim.w, d: prim.d, y0: prim.y0, y1: prim.y1 };
          const mesh = createLadderMesh(ladderData, mat, ladderOpts);
          if (mesh) {
            mesh.name = prim.name;
            scene.add(mesh);
          }
        }
        break;
      }

      case 'edges':
        // GLB doesn't need explicit edge faces — BoxGeometry includes all faces
        break;
    }
  }

  return scene;
}
