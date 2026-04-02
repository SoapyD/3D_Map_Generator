import * as THREE from 'three';

/**
 * Simple buffer geometry merge (replaces three/examples mergeBufferGeometries).
 */
export function mergeBufferGeometries(geometries) {
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
