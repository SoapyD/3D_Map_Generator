/**
 * Test helper: runs the generation stages one by one (mirroring src/pipeline.js) and returns each
 * stage's output, so stage tests can assert on a single stage's contract. Results are cached per
 * seed/options because the stages are deterministic for a given seed. Stage banners/logging are
 * silenced while generating.
 */

import { vi } from 'vitest';
import { DEFAULTS } from '../../src/config.js';
import { createRng } from '../../src/core/rng.js';
import { generateGrid } from '../../src/generators/foundations/grid.js';
import { createCollisionMatrix, CELL, STAGE } from '../../src/generators/collision/matrix.js';
import { generateBuildings } from '../../src/generators/buildings/index.js';
import { generateFloors } from '../../src/generators/floors/index.js';
import { generateRoofs } from '../../src/generators/roofs/index.js';
import { generateStreets } from '../../src/generators/streets/index.js';
import { generateConnectivity } from '../../src/generators/connectivity/index.js';
import { generateLadders } from '../../src/generators/ladders/index.js';
import { generateWalls } from '../../src/generators/walls/index.js';
import { generateCover } from '../../src/generators/cover/index.js';
import { buildGeometry } from '../../src/generators/geometry/index.js';
import { applyProfile } from '../../src/profiles/apply-profile.js';
import { profileDefaults } from '../../src/profiles/profile-defaults.js';

const cache = new Map();

export function makeConfig(seed, overrides = {}) {
  return { ...DEFAULTS, ...profileDefaults(overrides.profile), ...overrides, seed };
}

/** Run a callback with console.log silenced (generators are chatty). */
export function quiet(fn) {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/**
 * @returns {{ config, matrix, grid, buildings, floors, roofs, streets, connectivity, ladders, walls, cover, geometry }}
 */
export function runStages(seed, overrides = {}) {
  const key = `${seed}:${JSON.stringify(overrides)}`;
  if (cache.has(key)) return cache.get(key);

  const result = quiet(() => {
    const config = makeConfig(seed, overrides);
    const rng = createRng(config.seed);
    const restoreProfile = applyProfile(config); // no-op unless overrides.profile is set
    try {

    const grid = generateGrid(config, rng);
    const matrix = createCollisionMatrix(grid.activeArea, config.tiers, config);
    const slabY = -config.slabThickness;
    matrix.setWriteContext(STAGE.BUILDINGS, 0);
    for (const b of grid.blocks) {
      matrix.fillBox(b.x, slabY, b.z, b.w, config.slabThickness, b.d, CELL.FOUNDATION_PLACEHOLDER);
    }
    for (const s of grid.streetBounds) {
      matrix.fillBox(s.x, slabY, s.z, s.w, config.slabThickness, s.d, CELL.STREET_PLACEHOLDER);
    }

    const buildings = generateBuildings(grid, config, rng, matrix);
    const floors = generateFloors(buildings, config, rng, matrix);
    const roofs = generateRoofs(floors, config, matrix);
    const streets = generateStreets(roofs, config, rng, matrix);
    const connectivity = generateConnectivity(streets, config, rng, matrix);
    const ladders = generateLadders(connectivity, config, rng, matrix);
    const walls = generateWalls(ladders, config, rng, matrix);
    const cover = generateCover(walls, config, rng, matrix);
    const geometry = buildGeometry(cover, config);

    return { config, matrix, grid, buildings, floors, roofs, streets, connectivity, ladders, walls, cover, geometry };
    } finally {
      restoreProfile();
    }
  });

  cache.set(key, result);
  return result;
}

/** Count geometry primitives whose name starts with any of the given prefixes. */
export function countPrims(geometry, ...prefixes) {
  return geometry.primitives.filter(p => prefixes.some(pre => p.name.startsWith(pre))).length;
}
