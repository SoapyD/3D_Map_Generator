import { slabCellHeight } from './slabCellHeight.js';
import { levelHeight } from './levelHeight.js';

/** Number of 1" matrix rows of wall between a floor surface and the slab cell above it. */
export function wallMatrixRows(config) {
  return levelHeight(config) - slabCellHeight(config);
}
