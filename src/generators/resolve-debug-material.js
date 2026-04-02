import * as THREE from 'three';

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
export function resolveDebugMaterial(name) {
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
