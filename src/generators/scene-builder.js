/**
 * Scene Builder — converts pipeline data into Three.js scene geometry.
 */

import * as THREE from 'three';
import { createFloorSlab, createWallSlab, createSlab } from '../core/geometry.js';

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
  ladder: new THREE.MeshStandardMaterial({ color: 0xcccc22, roughness: 0.7 }),   // yellow
  walkway: new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.7 }),  // blue
  ramp: new THREE.MeshStandardMaterial({ color: 0x44aa44, roughness: 0.7 }),     // green
  groundLadder: new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 }), // red
  orangeLadder: new THREE.MeshStandardMaterial({ color: 0xee8822, roughness: 0.7 }), // orange
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

  // Build connections
  if (data.connections) {
    const { ladders, walkways } = data.connections;

    // Ladders — thin vertical slabs (yellow)
    for (let i = 0; i < ladders.length; i++) {
      const l = ladders[i];
      const height = l.y1 - l.y0;
      const mesh = createSlab(
        l.x + l.w / 2,
        l.y0 + height / 2,
        l.z + l.d / 2,
        l.w, height, l.d,
        MATERIALS.ladder,
      );
      mesh.name = `ladder_${i}`;
      scene.add(mesh);
    }

    // Walkways — flat horizontal slabs (blue = ok, green = blocked for debug)
    for (let i = 0; i < walkways.length; i++) {
      const w = walkways[i];
      const mat = w.blocked ? MATERIALS.ramp : MATERIALS.walkway;
      const mesh = createFloorSlab(
        { x: w.x, z: w.z, w: w.w, d: w.d },
        w.y,
        0.3,
        mat,
      );
      mesh.name = w.blocked ? `walkway_BLOCKED_${i}` : `walkway_${i}`;
      scene.add(mesh);
    }

    // Ground ladders — thin vertical slabs (red)
    const groundLadders = data.connections.groundLadders || [];
    for (let i = 0; i < groundLadders.length; i++) {
      const l = groundLadders[i];
      const height = l.y1 - l.y0;
      const mesh = createSlab(
        l.x + l.w / 2,
        l.y0 + height / 2,
        l.z + l.d / 2,
        l.w, height, l.d,
        MATERIALS.groundLadder,
      );
      mesh.name = `ground_ladder_${i}`;
      scene.add(mesh);
    }

    // Orange ladders — thin vertical slabs (orange)
    const orangeLadders = data.connections.orangeLadders || [];
    for (let i = 0; i < orangeLadders.length; i++) {
      const l = orangeLadders[i];
      const height = l.y1 - l.y0;
      const mesh = createSlab(
        l.x + l.w / 2,
        l.y0 + height / 2,
        l.z + l.d / 2,
        l.w, height, l.d,
        MATERIALS.orangeLadder,
      );
      mesh.name = `orange_ladder_${i}`;
      scene.add(mesh);
    }
  }

  return scene;
}

/**
 * Build an angled ramp mesh.
 * The ramp goes from y0 at one end to y1 at the other.
 */
function buildRampMesh(ramp, material) {
  const { x, z, w, d, y0, y1, side } = ramp;
  const thickness = 0.3;

  // Create a box and shear it to form a ramp
  // Simpler approach: use a flat slab positioned at the midpoint angle
  const length = ramp.axis === 'x' ? w : d;
  const width = ramp.axis === 'x' ? d : w;
  const height = y1 - y0;
  const rampLength = Math.sqrt(length * length + height * height);
  const angle = Math.atan2(height, length);

  const geometry = new THREE.BoxGeometry(rampLength, thickness, width);
  const mesh = new THREE.Mesh(geometry, material);

  // Position at midpoint
  const midX = x + w / 2;
  const midZ = z + d / 2;
  const midY = (y0 + y1) / 2;
  mesh.position.set(midX, midY, midZ);

  // Rotate to angle — direction depends on which side the ramp is on
  switch (side) {
    case 'north':
      mesh.rotation.z = angle;
      break;
    case 'south':
      mesh.rotation.z = -angle;
      break;
    case 'west':
      mesh.rotation.x = -angle;
      break;
    case 'east':
      mesh.rotation.x = angle;
      break;
  }

  return mesh;
}
