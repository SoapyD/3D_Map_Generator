import { floorThickness } from './floorThickness.js';
import { levelHeight } from './levelHeight.js';

/** Rendered wall height between a floor surface and the underside of the slab above it. */
export function wallGeomHeight(config) {
  return levelHeight(config) - floorThickness(config);
}
