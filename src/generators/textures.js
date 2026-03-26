/**
 * Texture system for Mordheim terrain.
 *
 * Since the GLB exporter can't embed DataTextures, we use flat coloured
 * materials with palette-based colours. Each building gets a consistent
 * colour from the pool, giving visual variety without texture maps.
 */

import * as THREE from 'three';

// Mordheim colour palettes — muted, grimy, dark (RGB 0-1)
const WALL_PALETTES = [
  [0.35, 0.30, 0.25],  // dark brown stone
  [0.40, 0.38, 0.35],  // grey-brown
  [0.32, 0.28, 0.28],  // dark reddish
  [0.38, 0.36, 0.30],  // yellowish stone
];

const LANDMARK_WALL_PALETTES = [
  [0.30, 0.25, 0.22],  // dark grand stone
  [0.28, 0.30, 0.32],  // slate grey
  [0.25, 0.22, 0.20],  // near-black stone
  [0.35, 0.28, 0.22],  // burnt umber
];

const FLOOR_PALETTES = [
  [0.30, 0.22, 0.15],  // dark oak
  [0.35, 0.28, 0.18],  // aged pine
  [0.28, 0.20, 0.14],  // walnut
  [0.32, 0.25, 0.17],  // chestnut
];

const CRATE_PALETTES = [
  [0.45, 0.38, 0.28],  // light pine crate
  [0.50, 0.42, 0.30],  // pale crate
  [0.42, 0.35, 0.25],  // standard crate
];

const STONE_BLOCK_PALETTES = WALL_PALETTES;

const COURTYARD_PALETTES = [
  [0.40, 0.38, 0.35],  // grey flagstone
  [0.38, 0.35, 0.30],  // warm flagstone
  [0.35, 0.33, 0.32],  // dark flagstone
];

const LADDER_PALETTES = [
  [0.35, 0.25, 0.15],  // dark wood
  [0.40, 0.30, 0.18],  // medium wood
  [0.30, 0.22, 0.14],  // aged wood
  [0.38, 0.28, 0.17],  // warm wood
];

const BASE_PALETTES = [
  [0.35, 0.33, 0.30],  // stone slabs
  [0.30, 0.25, 0.18],  // mud
  [0.38, 0.36, 0.34],  // grey rubble
];

function makeMat(rgb) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    roughness: 0.85,
  });
}

/**
 * Build all material pools.
 */
export function buildTexturePools() {
  return {
    walls: WALL_PALETTES.map(makeMat),
    landmarkWalls: LANDMARK_WALL_PALETTES.map(makeMat),
    floors: FLOOR_PALETTES.map(makeMat),
    crates: CRATE_PALETTES.map(makeMat),
    stoneBlocks: STONE_BLOCK_PALETTES.map(makeMat),
    courtyards: COURTYARD_PALETTES.map(makeMat),
    ladders: LADDER_PALETTES.map(makeMat),
    base: BASE_PALETTES.map(makeMat),
  };
}

/**
 * Pick a material from a pool using an index (deterministic per-building).
 */
export function pickFromPool(pool, index) {
  return pool[Math.abs(index) % pool.length];
}
