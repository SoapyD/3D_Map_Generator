import { createSlab } from './geometry-misc.js';

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
