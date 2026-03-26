/**
 * Texture loader — loads PNG textures from a texture pack directory.
 *
 * Pack structure:
 *   assets/textures/{packName}/
 *     walls/          ← PNG files
 *     floors/
 *     objects/
 *     ladders/
 *     walkways/
 *     courtyards/
 *     base_map/
 *     landmark_walls/
 *
 * Each subfolder's PNGs become a material pool. Materials carry _pngBuffer
 * for the GLB exporter to embed.
 */

import * as THREE from 'three';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const CATEGORIES = [
  'walls', 'landmark_walls', 'floors', 'objects',
  'ladders', 'walkways', 'courtyards', 'base_map',
];

/**
 * Load a texture pack by name. Falls back to flat colour if directory missing.
 */
export function buildTexturePools(packName = 'base') {
  const packDir = path.join('assets', 'textures', packName);
  const pools = {};

  for (const cat of CATEGORIES) {
    const catDir = path.join(packDir, cat);
    if (existsSync(catDir)) {
      const files = readdirSync(catDir).filter((f) => f.endsWith('.png')).sort();
      pools[cat] = files.map((f) => {
        const pngBuffer = readFileSync(path.join(catDir, f));
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
        mat._pngBuffer = pngBuffer;
        return mat;
      });
    }

    // Fallback: if no textures found, create a grey material
    if (!pools[cat] || pools[cat].length === 0) {
      pools[cat] = [new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85 })];
    }
  }

  return pools;
}

/**
 * Pick a material from a pool using an index (deterministic per-building).
 */
export function pickFromPool(pool, index) {
  return pool[Math.abs(index) % pool.length];
}
