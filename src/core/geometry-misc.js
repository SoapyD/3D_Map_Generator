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

/**
 * Simple buffer geometry merge (replaces three/examples mergeBufferGeometries).
 */
function mergeBufferGeometries(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let indexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const idx = geo.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + indexOffset);
      }
    }

    indexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length) merged.setIndex(indices);

  return merged;
}


/**
 * Create a detailed ladder mesh: two vertical poles with horizontal rungs.
 *
 * @param {object} ladder - { x, z, w, d, y0, y1 }
 * @param {THREE.Material} material
 * @param {object} opts - { poleRadius, rungRadius, rungSpacing, rungInset }
 * @returns {THREE.Mesh}
 */
export function createLadderMesh(ladder, material, opts) {
  const { poleRadius, rungRadius, rungSpacing, rungInset } = opts;
  const height = ladder.y1 - ladder.y0;
  if (height <= 0) return null;

  const segments = 6; // polygon segments for cylinders
  const geometries = [];

  // Determine ladder orientation — thin axis faces the wall
  const isThinX = ladder.w < ladder.d;
  const ladderWidth = isThinX ? ladder.d : ladder.w;

  // Pole positions: at each side of the ladder's wide axis
  const cx = ladder.x + ladder.w / 2;
  const cz = ladder.z + ladder.d / 2;
  const cy = ladder.y0 + height / 2;

  const halfSpread = (ladderWidth / 2) - poleRadius - rungInset;

  // Two vertical poles
  for (const side of [-1, 1]) {
    const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, height, segments);
    if (isThinX) {
      poleGeo.translate(cx, cy, cz + side * halfSpread);
    } else {
      poleGeo.translate(cx + side * halfSpread, cy, cz);
    }
    geometries.push(poleGeo);
  }

  // Rungs
  const rungCount = Math.floor(height / rungSpacing);
  const rungLength = halfSpread * 2;
  for (let i = 1; i <= rungCount; i++) {
    const ry = ladder.y0 + i * rungSpacing;
    if (ry >= ladder.y1 - rungSpacing * 0.3) break;

    const rungGeo = new THREE.CylinderGeometry(rungRadius, rungRadius, rungLength, segments);
    // Rotate rung to be horizontal
    if (isThinX) {
      rungGeo.rotateX(Math.PI / 2);
      rungGeo.translate(cx, ry, cz);
    } else {
      rungGeo.rotateZ(Math.PI / 2);
      rungGeo.translate(cx, ry, cz);
    }
    geometries.push(rungGeo);
  }

  if (geometries.length === 0) return null;

  const merged = mergeBufferGeometries(geometries);
  geometries.forEach((g) => g.dispose());

  const mesh = new THREE.Mesh(merged, material);
  return mesh;
}
