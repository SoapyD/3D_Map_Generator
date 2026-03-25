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
export function createSlab(x, y, z, width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Create a floor slab from a 2D rectangle definition.
 * Rectangle is defined by its min corner (x, z) and dimensions (w, d).
 * The slab is placed at the given Y (tier height) with constant thickness.
 *
 * @param {{ x: number, z: number, w: number, d: number }} rect - 2D footprint
 * @param {number} y - Y position (bottom of slab)
 * @param {number} thickness - Slab thickness
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
export function createFloorSlab(rect, y, thickness, material) {
  return createSlab(
    rect.x + rect.w / 2,
    y + thickness / 2,
    rect.z + rect.d / 2,
    rect.w,
    thickness,
    rect.d,
    material,
  );
}

/**
 * Create a wall slab from position, dimensions, and orientation.
 *
 * @param {number} x - Start X
 * @param {number} z - Start Z
 * @param {number} length - Wall length
 * @param {number} height - Wall height
 * @param {number} y - Base Y position
 * @param {number} thickness - Wall thickness
 * @param {'x' | 'z'} axis - Which axis the wall runs along
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
export function createWallSlab(x, z, length, height, y, thickness, axis, material) {
  const w = axis === 'x' ? length : thickness;
  const d = axis === 'z' ? length : thickness;

  return createSlab(
    x + w / 2,
    y + height / 2,
    z + d / 2,
    w,
    height,
    d,
    material,
  );
}

/**
 * Merge an array of meshes into a single BufferGeometry for performance.
 * Returns a new mesh with the merged geometry.
 *
 * @param {THREE.Mesh[]} meshes
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
export function mergeMeshes(meshes, material) {
  if (meshes.length === 0) return null;

  const geometries = meshes.map((mesh) => {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    return geo;
  });

  const merged = mergeBufferGeometries(geometries);
  geometries.forEach((g) => g.dispose());

  return new THREE.Mesh(merged, material);
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
