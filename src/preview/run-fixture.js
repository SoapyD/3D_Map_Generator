/**
 * Wrap a generated run (<base>_geometry.json + its config) as a withering-map/2 fixture
 * so the Loaded map tab can show the current run without a fixture file.
 */

import { FLOOR_SLAB, LOADED_MAP } from '../config.js';

export function buildRunFixture(geometry, config) {
  const cm = geometry?.collisionMatrix;
  if (!cm || !Array.isArray(cm.cells) || !Array.isArray(geometry.primitives)) return null;
  const { cells, ...matrixMeta } = cm;
  return {
    format: LOADED_MAP.fixtureFormats[LOADED_MAP.fixtureFormats.length - 1],
    generator: { rev: 'current-run', dirty: false, version: 'local' },
    seed: config.seed,
    opts: {
      mapWidth: config.mapWidth, mapDepth: config.mapDepth, tiers: config.tiers,
      levelHeight: config.tierHeight, floorThickness: FLOOR_SLAB.thickness,
    },
    matrix: { ...matrixMeta, cellsBase64: Buffer.from(Uint8Array.from(cells)).toString('base64') },
    primitives: geometry.primitives,
  };
}
