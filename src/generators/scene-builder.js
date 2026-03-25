/**
 * Scene Builder — converts pipeline data into Three.js scene geometry.
 */

import * as THREE from 'three';
import { createFloorSlab, createWallSlab } from '../core/geometry.js';

const MATERIALS = {
  base: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }),
  floor: [
    new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x7a6848, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x6b5c3e, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x5c5034, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x4d442a, roughness: 0.8 }),
  ],
  wall: new THREE.MeshStandardMaterial({ color: 0x9b8b75, roughness: 0.85 }),
};

/**
 * Build a Three.js scene from the pipeline data.
 */
export function buildScene(data, config) {
  const scene = new THREE.Scene();

  // Build floor slabs
  for (const floorData of data.floors) {
    const tier = floorData.tier;
    const y = tier * config.tierHeight;
    const material =
      tier === 0 ? MATERIALS.base : MATERIALS.floor[Math.min(tier - 1, MATERIALS.floor.length - 1)];

    for (const section of floorData.sections) {
      const mesh = createFloorSlab(section, y, config.slabThickness, material);
      mesh.name = `floor_t${tier}_${Math.round(section.x)}_${Math.round(section.z)}`;
      scene.add(mesh);
    }
  }

  // Build wall slabs
  if (data.walls) {
    for (let i = 0; i < data.walls.length; i++) {
      const w = data.walls[i];
      const mesh = createWallSlab(
        w.x, w.z, w.length, w.height, w.baseY, w.thickness, w.axis, MATERIALS.wall,
      );
      mesh.name = `wall_${i}`;
      scene.add(mesh);
    }
  }

  return scene;
}
