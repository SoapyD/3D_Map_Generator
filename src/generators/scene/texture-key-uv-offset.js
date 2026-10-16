import { GEOMETRY } from '../../config.js';

const UINT32_RANGE = 2 ** 32;
const fract = (v) => v - Math.floor(v);

/**
 * Texture offset (in tile units) shared by every box with the same texture key. One offset per
 * key keeps adjacent boxes aligned (no seams) while different textures do not all start at the
 * same phase. Deterministic: depends only on the key string.
 *
 * @param {string|undefined} textureKey
 * @returns {[number, number]} [u, v] offset in 0..1
 */
export function textureKeyUvOffset(textureKey) {
  const { hashBase, scaleU, scaleV } = GEOMETRY.uvKeyOffset;
  let h = 0;
  for (const ch of textureKey ?? '') h = (Math.imul(h, hashBase) + ch.charCodeAt(0)) >>> 0;
  const t = h / UINT32_RANGE;
  return [fract(t * scaleU), fract(t * scaleV)];
}
