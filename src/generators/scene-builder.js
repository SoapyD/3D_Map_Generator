/**
 * Scene Builder — converts pipeline data into Three.js scene geometry.
 * Uses debug colours when config.debug is true, textured materials otherwise.
 */

import * as THREE from 'three';
import { createFloorSlab, createWallSlab, createSlab, createLadderMesh } from '../core/geometry.js';
import { buildTexturePools, pickFromPool } from './textures.js';
import { LADDER_DISPLAY, COVER, GEOMETRY } from '../config.js';

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
};

/**
 * Find which building a floor section or wall belongs to.
 */
function findBuildingIndex(x, z, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x >= b.x - 0.5 && x <= b.x + b.w + 0.5 && z >= b.z - 0.5 && z <= b.z + b.d + 0.5) {
      return i;
    }
  }
  return -1;
}

/**
 * Build a Three.js scene from the pipeline data.
 */
export function buildScene(data, config) {
  const scene = new THREE.Scene();
  const debug = config.debug;

  // Build texture pools for textured mode
  let pools = null;
  if (!debug) {
    pools = buildTexturePools(config.textureSet || 'base');
  }

  // Build floor slabs
  for (const floorData of data.floors) {
    const tier = floorData.tier;
    const y = tier * config.tierHeight;

    for (const section of floorData.sections) {
      let material;
      if (debug) {
        material = tier === 0
          ? DEBUG_MATERIALS.base
          : DEBUG_MATERIALS.floor[Math.min(tier - 1, DEBUG_MATERIALS.floor.length - 1)];
      } else if (tier === 0) {
        material = pickFromPool(pools.base_map, Math.floor(section.x * 7 + section.z * 13));
      } else {
        const bi = findBuildingIndex(section.x, section.z, data.buildings);
        if (bi >= 0 && data.buildings[bi].size !== 'small') {
          // Deleted footprints use courtyard
          material = pickFromPool(pools.floors, bi);
        } else {
          material = pickFromPool(pools.floors, bi >= 0 ? bi : 0);
        }
      }

      const mesh = createFloorSlab(section, y, config.slabThickness, material);
      mesh.name = `floor_t${tier}_${Math.round(section.x)}_${Math.round(section.z)}`;
      scene.add(mesh);
    }
  }

  // Build wall slabs
  if (data.walls) {
    for (let i = 0; i < data.walls.length; i++) {
      const w = data.walls[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.wall;
      } else {
        const bi = findBuildingIndex(w.x, w.z, data.buildings);
        if (bi >= 0 && (data.buildings[bi].size === 'large' || data.buildings[bi].size === 'medium')) {
          material = pickFromPool(pools.landmark_walls, bi);
        } else {
          material = pickFromPool(pools.walls, bi >= 0 ? bi : i);
        }
      }
      const mesh = createWallSlab(w.x, w.z, w.length, w.height, w.baseY, w.thickness, w.axis, material);
      mesh.name = `wall_${i}`;
      scene.add(mesh);
    }
  }

  // Build connections
  if (data.connections) {
    const { ladders, walkways } = data.connections;

    const ladderOpts = {
      poleRadius: LADDER_DISPLAY.poleRadius,
      rungRadius: LADDER_DISPLAY.rungRadius,
      rungSpacing: LADDER_DISPLAY.rungSpacing,
      rungInset: LADDER_DISPLAY.rungInset,
    };

    // Helper: add ladder (box + mesh versions)
    function addLadder(l, material, name) {
      if (LADDER_DISPLAY.showBoxLadders) {
        const height = l.y1 - l.y0;
        const box = createSlab(l.x + l.w / 2, l.y0 + height / 2, l.z + l.d / 2, l.w, height, l.d, material);
        box.name = name + '_box';
        scene.add(box);
      }
      if (LADDER_DISPLAY.showMeshLadders) {
        const mesh = createLadderMesh(l, material, ladderOpts);
        if (mesh) {
          mesh.name = name;
          scene.add(mesh);
        }
      }
    }

    // Yellow ladders
    for (let i = 0; i < ladders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.ladder : pickFromPool(pools.ladders, i);
      addLadder(ladders[i], material, `ladder_${i}`);
    }

    // Walkways
    for (let i = 0; i < walkways.length; i++) {
      const w = walkways[i];
      let material;
      if (debug) {
        material = w.blocked ? DEBUG_MATERIALS.ramp : DEBUG_MATERIALS.walkway;
      } else {
        material = pickFromPool(pools.walkways, i);
      }
      const mesh = createFloorSlab({ x: w.x, z: w.z, w: w.w, d: w.d }, w.y, GEOMETRY.walkwayThickness, material, { rotateUV: w.w > w.d });
      mesh.name = w.blocked ? `walkway_BLOCKED_${i}` : `walkway_${i}`;
      scene.add(mesh);
    }

    // Red ground ladders
    const groundLadders = data.connections.groundLadders || [];
    for (let i = 0; i < groundLadders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.groundLadder : pickFromPool(pools.ladders, i + 10);
      addLadder(groundLadders[i], material, `ground_ladder_${i}`);
    }

    // Orange ladders
    const orangeLadders = data.connections.orangeLadders || [];
    for (let i = 0; i < orangeLadders.length; i++) {
      const l = orangeLadders[i];
      const material = l.bad ? DEBUG_MATERIALS.badLadder : (debug ? DEBUG_MATERIALS.orangeLadder : pickFromPool(pools.ladders, i + 20));
      addLadder(l, material, l.bad ? `orange_ladder_BAD_${i}` : `orange_ladder_${i}`);
    }

    // Interior ladders — cyan
    const interiorLadders = data.connections.interiorLadders || [];
    for (let i = 0; i < interiorLadders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.interiorLadder : pickFromPool(pools.ladders, i + 30);
      addLadder(interiorLadders[i], material, `interior_ladder_${i}`);
    }

    // Ladder platforms — white
    const ladderPlatforms = data.connections.ladderPlatforms || [];
    for (let i = 0; i < ladderPlatforms.length; i++) {
      const p = ladderPlatforms[i];
      // All platforms from the same ladder share the same texture
      const material = debug ? DEBUG_MATERIALS.ladderPlatform : pickFromPool(pools.floors, p.ladderIndex);
      const mesh = createFloorSlab({ x: p.x, z: p.z, w: p.w, d: p.d }, p.y, GEOMETRY.platformThickness, material);
      mesh.name = `ladder_platform_${i}`;
      scene.add(mesh);
    }
  }

  // Cover pieces
  if (data.cover) {
    for (let i = 0; i < data.cover.length; i++) {
      const c = data.cover[i];
      const bodyMat = debug ? DEBUG_MATERIALS.cover : pickFromPool(pools.objects, i);
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, bodyMat);
      mesh.name = `cover_${i}`;
      scene.add(mesh);
    }
  }

  // Interior cover
  if (data.interiorCover) {
    for (let i = 0; i < data.interiorCover.length; i++) {
      const c = data.interiorCover[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.interiorCover;
      } else {
        material = pickFromPool(pools.objects, i + 50);
      }
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, material);
      mesh.name = `interior_cover_${i}`;
      scene.add(mesh);
    }
  }

  // Debug: pink footprints for deleted building positions
  if (data.deletedFootprints) {
    for (let i = 0; i < data.deletedFootprints.length; i++) {
      const df = data.deletedFootprints[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.deletedFootprint;
      } else {
        material = pickFromPool(pools.courtyards, i);
      }
      const mesh = createFloorSlab({ x: df.x, z: df.z, w: df.w, d: df.d }, GEOMETRY.courtyardY, GEOMETRY.courtyardThickness, material);
      mesh.name = `deleted_${i}`;
      scene.add(mesh);
    }
  }

  // Street scatter
  if (data.streetScatter) {
    for (let i = 0; i < data.streetScatter.length; i++) {
      const c = data.streetScatter[i];
      const material = debug ? DEBUG_MATERIALS.streetScatter : pickFromPool(pools.objects, i + 100);
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, material);
      mesh.name = `street_scatter_${i}`;
      scene.add(mesh);
    }
  }

  return scene;
}
