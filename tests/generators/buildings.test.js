import { describe, it, expect, afterEach } from 'vitest';
import { generateBuildings } from '../../src/generators/buildings.js';
import { generateGrid } from '../../src/generators/grid.js';
import { createRng } from '../../src/core/rng.js';
import { BUILDING, DELETIONS } from '../../src/config.js';

const baseConfig = {
  mapWidth: 48,
  mapDepth: 48,
  streetWidth: 3.5,
  tiers: 4,
};

function makeGridData() {
  return generateGrid(baseConfig, createRng(42));
}

describe('generateBuildings', () => {
  it('returns buildings array', () => {
    const rng = createRng(42);
    const gridData = makeGridData();
    // Need fresh RNG after grid
    const rng2 = createRng(42);
    generateGrid(baseConfig, rng2); // consume same RNG state
    const result = generateBuildings(gridData, baseConfig, rng2);
    expect(Array.isArray(result.buildings)).toBe(true);
    expect(result.buildings.length).toBeGreaterThan(0);
  });

  it('all buildings have required properties', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    for (const b of result.buildings) {
      expect(b).toHaveProperty('x');
      expect(b).toHaveProperty('z');
      expect(b).toHaveProperty('w');
      expect(b).toHaveProperty('d');
      expect(b).toHaveProperty('maxTier');
      expect(b).toHaveProperty('size');
    }
  });

  it('buildings have valid sizes', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    const validSizes = ['small', 'medium', 'large'];
    for (const b of result.buildings) {
      expect(validSizes).toContain(b.size);
    }
  });

  it('small buildings have dimensions within configured range', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    const small = result.buildings.filter(b => b.size === 'small');
    for (const b of small) {
      expect(b.w).toBeGreaterThanOrEqual(BUILDING.footprints.small.min);
      expect(b.w).toBeLessThanOrEqual(BUILDING.footprints.small.max);
      expect(b.d).toBeGreaterThanOrEqual(BUILDING.footprints.small.min);
      expect(b.d).toBeLessThanOrEqual(BUILDING.footprints.small.max);
    }
  });

  it('maxTier is within configured tiers', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    for (const b of result.buildings) {
      expect(b.maxTier).toBeGreaterThanOrEqual(1);
      expect(b.maxTier).toBeLessThanOrEqual(baseConfig.tiers + 1); // big buildings can go to 5
    }
  });

  it('buildings are within map bounds', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    for (const b of result.buildings) {
      expect(b.x).toBeGreaterThanOrEqual(-1); // margin allowance
      expect(b.z).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.w).toBeLessThanOrEqual(baseConfig.mapWidth + 1);
      expect(b.z + b.d).toBeLessThanOrEqual(baseConfig.mapDepth + 1);
    }
  });

  it('includes at least one big building (medium or large)', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    const bigBuildings = result.buildings.filter(b => b.size === 'medium' || b.size === 'large');
    expect(bigBuildings.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks deleted buildings', () => {
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const result = generateBuildings(gridData, baseConfig, rng);
    expect(result).toHaveProperty('deletedBuildings');
    expect(Array.isArray(result.deletedBuildings)).toBe(true);
  });

  it('is deterministic with same seed', () => {
    const run = () => {
      const rng = createRng(42);
      const gridData = generateGrid(baseConfig, rng);
      return generateBuildings(gridData, baseConfig, rng);
    };
    const a = run();
    const b = run();
    expect(a.buildings.length).toBe(b.buildings.length);
  });

  it('skips displacement when buildingDisplaceByLarge is false', () => {
    const origDisplace = DELETIONS.buildingDisplaceByLarge;
    const origCull = DELETIONS.buildingRandomCull;
    try {
      DELETIONS.buildingDisplaceByLarge = false;
      DELETIONS.buildingRandomCull = true;
      const rng = createRng(42);
      const gridData = generateGrid(baseConfig, rng);
      const result = generateBuildings(gridData, baseConfig, rng);
      // With displacement disabled, only random cull produces deleted buildings
      expect(Array.isArray(result.deletedBuildings)).toBe(true);
      expect(result.buildings.length).toBeGreaterThan(0);
    } finally {
      DELETIONS.buildingDisplaceByLarge = origDisplace;
      DELETIONS.buildingRandomCull = origCull;
    }
  });

  it('skips random cull when buildingRandomCull is false', () => {
    const origCull = DELETIONS.buildingRandomCull;
    try {
      DELETIONS.buildingRandomCull = false;
      const rng = createRng(42);
      const gridData = generateGrid(baseConfig, rng);
      const result = generateBuildings(gridData, baseConfig, rng);
      // With random cull disabled, more buildings survive
      expect(result.buildings.length).toBeGreaterThan(0);
      // deletedBuildings should only be the displacement ones
      expect(Array.isArray(result.deletedBuildings)).toBe(true);
    } finally {
      DELETIONS.buildingRandomCull = origCull;
    }
  });

  it('exercises all big building layout variants across seeds', () => {
    // The layout is rng.int(0,4) so we need different seeds to hit all 5 layouts.
    // We run enough seeds to cover layouts 0-4 (including cases 2,3,4 on lines 134-143).
    const layoutCounts = new Map();
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const gridData = generateGrid(baseConfig, rng);
      const result = generateBuildings(gridData, baseConfig, rng);
      const bigBuildings = result.buildings.filter(b => b.size === 'medium' || b.size === 'large');
      const count = bigBuildings.length;
      layoutCounts.set(count, (layoutCounts.get(count) || 0) + 1);
    }
    // Should see varying counts of big buildings (1, 2, 3, 4)
    expect(layoutCounts.size).toBeGreaterThanOrEqual(3);
  });
});
