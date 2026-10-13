import * as THREE from 'three';
import { boxFaceWorldUv } from './box-face-world-uv.js';

const NO_OFFSET = [0, 0];
const VERTS_PER_FACE = 4;
const FACE_COUNT = 6;

/**
 * Create a box (slab) mesh at the given position and size.
 * All geometry in this project is axis-aligned boxes.
 *
 * UVs are world-space (world position / GEOMETRY.glbTileSize), so adjacent boxes share UVs along
 * a common edge and merged or split boxes of one texture look identical.
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y (up)
 * @param {number} z - Center Z
 * @param {number} width - Size along X
 * @param {number} height - Size along Y
 * @param {number} depth - Size along Z
 * @param {THREE.Material} material
 * @param {{ rotateUV?: boolean, uvOffset?: [number, number] }} [opts]
 *   rotateUV: top/bottom textures run along Z. uvOffset: texture offset in tile units.
 * @returns {THREE.Mesh}
 */
export function createSlab(x, y, z, width, height, depth, material, { rotateUV = false, uvOffset = NO_OFFSET } = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);

  const uv = geometry.getAttribute('uv');
  const pos = geometry.getAttribute('position');
  if (uv) {
    for (let face = 0; face < FACE_COUNT; face++) {
      for (let v = 0; v < VERTS_PER_FACE; v++) {
        const idx = face * VERTS_PER_FACE + v;
        const world = { x: x + pos.getX(idx), y: y + pos.getY(idx), z: z + pos.getZ(idx) };
        const [u, w] = boxFaceWorldUv(face, world, rotateUV, uvOffset);
        uv.setXY(idx, u, w);
      }
    }
    uv.needsUpdate = true;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}
