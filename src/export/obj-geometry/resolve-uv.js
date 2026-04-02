import { getUV } from './get-uv.js';
import { ensureTexture } from './ensure-texture.js';

/**
 * Resolve a texture key to UV coordinates.
 */
export function resolveUV(atlasState, textureKey, texturePools, gridSz, atlasSize) {
  return getUV(ensureTexture(atlasState, textureKey, texturePools), gridSz, atlasSize);
}
