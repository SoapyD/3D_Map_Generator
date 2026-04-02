import { PNG } from 'pngjs';
import { GEOMETRY } from '../../config.js';

const TILE_SIZE = GEOMETRY.objAtlasTileSize;
const PADDING = GEOMETRY.objAtlasPadding;
const PADDED_TILE = TILE_SIZE + PADDING * 2;

/**
 * Build the atlas PNG image from all registered textures.
 * Returns { atlas, gridSz, atlasSize }.
 */
export function buildAtlasImage(atlasState) {
  const gridSz = Math.ceil(Math.sqrt(atlasState.allTextures.length));
  const atlasSize = gridSz * PADDED_TILE;
  const atlas = new PNG({ width: atlasSize, height: atlasSize });
  for (let i = 0; i < atlasSize * atlasSize; i++) atlas.data[i * 4 + 3] = 255;

  for (let ti = 0; ti < atlasState.allTextures.length; ti++) {
    const col = ti % gridSz;
    const row = Math.floor(ti / gridSz);
    const src = atlasState.allTextures[ti];
    for (let y = -PADDING; y < TILE_SIZE + PADDING; y++) {
      for (let x = -PADDING; x < TILE_SIZE + PADDING; x++) {
        const sx = Math.max(0, Math.min(src.width - 1, x % src.width));
        const sy = Math.max(0, Math.min(src.height - 1, y % src.height));
        const si = (sy * src.width + sx) * 4;
        const dx = col * PADDED_TILE + PADDING + x;
        const dy = row * PADDED_TILE + PADDING + y;
        if (dx < 0 || dx >= atlasSize || dy < 0 || dy >= atlasSize) continue;
        const di = (dy * atlasSize + dx) * 4;
        atlas.data[di] = src.data[si];
        atlas.data[di + 1] = src.data[si + 1];
        atlas.data[di + 2] = src.data[si + 2];
        atlas.data[di + 3] = 255;
      }
    }
  }

  return { atlas, gridSz, atlasSize };
}
