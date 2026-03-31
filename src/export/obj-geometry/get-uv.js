import { GEOMETRY } from '../../config.js';

const TILE_SIZE = GEOMETRY.objAtlasTileSize;
const PADDING = GEOMETRY.objAtlasPadding;
const PADDED_TILE = TILE_SIZE + PADDING * 2;

/**
 * Get UV coordinates for a tile index within the atlas.
 */
export function getUV(tileIdx, gridSz, atlasSize) {
  const col = tileIdx % gridSz;
  const row = Math.floor(tileIdx / gridSz);
  return {
    uMin: (col * PADDED_TILE + PADDING) / atlasSize,
    uMax: (col * PADDED_TILE + PADDING + TILE_SIZE) / atlasSize,
    vMin: 1 - (row * PADDED_TILE + PADDING + TILE_SIZE) / atlasSize,
    vMax: 1 - (row * PADDED_TILE + PADDING) / atlasSize,
  };
}
