import { GEOMETRY } from '../config.js';

// BoxGeometry face order: +x, -x, +y, -y, +z, -z. The u sign matches BoxGeometry's own handedness
// (looking at the face from outside, u grows to the right), so textures are not mirrored.
const FACE_AXES = [
  { u: 'z', uSign: -1, v: 'y' },  // +x
  { u: 'z', uSign: 1,  v: 'y' },  // -x
  { u: 'x', uSign: 1,  v: 'z' },  // +y
  { u: 'x', uSign: 1,  v: 'z' },  // -y
  { u: 'x', uSign: 1,  v: 'y' },  // +z
  { u: 'x', uSign: -1, v: 'y' },  // -z
];
const TOP_BOTTOM_FACES = [2, 3];

/**
 * World-space UV of one box vertex: world position / GEOMETRY.glbTileSize along the face's two
 * axes, plus the texture offset. Adjacent boxes of one texture therefore line up with no seam.
 *
 * @param {number} face  BoxGeometry face index 0..5
 * @param {{x:number,y:number,z:number}} world  world position of the vertex
 * @param {boolean} rotateUV  top/bottom faces run their texture along Z instead of X
 * @param {[number, number]} offset  texture offset in tile units
 * @returns {[number, number]} [u, v]
 */
export function boxFaceWorldUv(face, world, rotateUV, offset) {
  const axes = FACE_AXES[face];
  let uAxis = axes.u, vAxis = axes.v;
  if (rotateUV && TOP_BOTTOM_FACES.includes(face)) [uAxis, vAxis] = [vAxis, uAxis];
  const tile = GEOMETRY.glbTileSize;
  return [axes.uSign * world[uAxis] / tile + offset[0], world[vAxis] / tile + offset[1]];
}
