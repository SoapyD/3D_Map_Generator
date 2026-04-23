/**
 * Texture loader — loads PNG textures from a texture pack directory.
 */

import * as THREE from 'three';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { PNG } from 'pngjs';
import path from 'path';
import { fileURLToPath } from 'url';

const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const CATEGORIES = [
  'walls', 'landmark_walls', 'floors', 'objects',
  'ladders', 'walkways', 'courtyards', 'base_map', 'roofs',
  'rivers', 'river_banks', 'streets', 'pavements',
];

/**
 * Load a texture pack by name. Falls back to flat colour if directory missing.
 */
export function buildTexturePools(packName = 'base') {
  const packDir = path.join(PACKAGE_ROOT, 'assets', 'textures', packName);
  const pools = {};

  for (const cat of CATEGORIES) {
    const catDir = path.join(packDir, cat);
    if (existsSync(catDir)) {
      const files = readdirSync(catDir).filter((f) => f.endsWith('.png')).sort();
      pools[cat] = files.map((f) => {
        const pngBuffer = readFileSync(path.join(catDir, f));
        // Check if PNG has transparency
        let avgAlpha = 1.0;
        try {
          const png = PNG.sync.read(pngBuffer);
          let totalAlpha = 0;
          for (let i = 0; i < png.width * png.height; i++) {
            totalAlpha += png.data[i * 4 + 3];
          }
          avgAlpha = totalAlpha / (png.width * png.height * 255);
        } catch (e) {}
        const hasAlpha = avgAlpha < 0.99;
        const mat = new THREE.MeshStandardMaterial({
          roughness: 0.85,
          transparent: hasAlpha,
          opacity: hasAlpha ? avgAlpha : 1.0,
        });
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
