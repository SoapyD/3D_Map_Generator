import { createSlab } from './geometry-misc.js';

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
export function createFloorSlab(rect, y, thickness, material, opts) {
  return createSlab(
    rect.x + rect.w / 2,
    y + thickness / 2,
    rect.z + rect.d / 2,
    rect.w,
    thickness,
    rect.d,
    material,
    opts,
  );
}
