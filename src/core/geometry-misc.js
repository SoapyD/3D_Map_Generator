import * as THREE from 'three';

/**
 * Create a box (slab) mesh at the given position and size.
 * All geometry in this project is axis-aligned boxes.
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y (up)
 * @param {number} z - Center Z
 * @param {number} width - Size along X
 * @param {number} height - Size along Y
 * @param {number} depth - Size along Z
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
import { GEOMETRY } from '../config.js';

const TILE_SIZE = GEOMETRY.glbTileSize;

export function createSlab(x, y, z, width, height, depth, material, { rotateUV = false } = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);

  // Scale UVs so textures tile at a fixed real-world scale
  const uv = geometry.getAttribute('uv');
  if (uv) {
    // BoxGeometry has 6 faces. Each face's UVs map 0-1.
    // We scale them by the face dimensions / TILE_SIZE.
    // Face order: +x, -x, +y, -y, +z, -z (4 verts each = 24 total)
    // rotateUV swaps U/V on top/bottom faces so textures run along the other axis
    const topU = rotateUV ? depth : width;
    const topV = rotateUV ? width : depth;
    const scales = [
      [depth / TILE_SIZE, height / TILE_SIZE],  // +x face
      [depth / TILE_SIZE, height / TILE_SIZE],  // -x face
      [topU / TILE_SIZE, topV / TILE_SIZE],     // +y face (top)
      [topU / TILE_SIZE, topV / TILE_SIZE],     // -y face (bottom)
      [width / TILE_SIZE, height / TILE_SIZE],  // +z face
      [width / TILE_SIZE, height / TILE_SIZE],  // -z face
    ];

    // Per-object UV offset to break tiling repetition
    const fract = (v) => v - Math.floor(v);
    const [hu0, hu1] = GEOMETRY.uvHashU;
    const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
    const offU = fract(x * hu0 + z * hu1);
    const offV = fract(x * hv0 + z * hv1 + y * hv2);

    for (let face = 0; face < 6; face++) {
      const [su, sv] = scales[face];
      for (let v = 0; v < 4; v++) {
        const idx = face * 4 + v;
        uv.setX(idx, uv.getX(idx) * su + offU);
        uv.setY(idx, uv.getY(idx) * sv + offV);
      }
    }
    uv.needsUpdate = true;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

