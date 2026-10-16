import * as THREE from 'three';

const FLOATS = { position: 3, normal: 3, uv: 2 };

/**
 * Concatenate world-space geometries into one indexed BufferGeometry (position, normal, uv).
 * Missing normal/uv attributes are zero-filled (they default to 0 in the unmerged case too);
 * non-indexed geometries get a sequential index.
 *
 * @param {THREE.BufferGeometry[]} geometries
 * @returns {{ geometry: THREE.BufferGeometry, ranges: { indexStart: number, indexCount: number }[] }}
 */
export function mergeGroupGeometry(geometries) {
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const g of geometries) {
    const count = g.getAttribute('position').count;
    vertexTotal += count;
    indexTotal += g.getIndex() ? g.getIndex().count : count;
  }

  const arrays = {};
  for (const [name, size] of Object.entries(FLOATS)) arrays[name] = new Float32Array(vertexTotal * size);
  const indices = new Uint32Array(indexTotal);
  const ranges = [];

  let vertexOffset = 0;
  let indexOffset = 0;
  for (const g of geometries) {
    const count = g.getAttribute('position').count;
    for (const [name, size] of Object.entries(FLOATS)) {
      const attr = g.getAttribute(name);
      if (attr) arrays[name].set(attr.array, vertexOffset * size);
    }
    const index = g.getIndex();
    const indexCount = index ? index.count : count;
    for (let i = 0; i < indexCount; i++) {
      indices[indexOffset + i] = (index ? index.array[i] : i) + vertexOffset;
    }
    ranges.push({ indexStart: indexOffset, indexCount });
    vertexOffset += count;
    indexOffset += indexCount;
  }

  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of Object.entries(FLOATS)) {
    geometry.setAttribute(name, new THREE.BufferAttribute(arrays[name], size));
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return { geometry, ranges };
}
