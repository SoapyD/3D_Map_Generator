import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateGrid } from '../src/generators/grid.js';
import { generateBuildings } from '../src/generators/buildings.js';

const baseConfig = { mapWidth: 48, mapDepth: 48, streetWidth: 3.5, tiers: 4 };

function getBuildings(seed = 42) {
  const rng = createRng(seed);
  const grid = generateGrid(baseConfig, rng);
  return generateBuildings(grid, baseConfig, rng);
}

describe('Building Generator', () => {
  it('produces buildings', () => {
    const data = getBuildings();
    assert.ok(data.buildings.length > 0);
  });

  it('all buildings have positive dimensions', () => {
    const data = getBuildings();
    for (const b of data.buildings) {
      assert.ok(b.w > 0, `Width ${b.w} must be positive`);
      assert.ok(b.d > 0, `Depth ${b.d} must be positive`);
    }
  });

  it('all buildings have a valid maxTier', () => {
    const data = getBuildings();
    for (const b of data.buildings) {
      assert.ok(b.maxTier >= 1, `maxTier ${b.maxTier} must be >= 1`);
      assert.ok(b.maxTier <= baseConfig.tiers, `maxTier ${b.maxTier} must be <= ${baseConfig.tiers}`);
    }
  });

  it('produces a mix of building sizes', () => {
    const data = getBuildings();
    const sizes = new Set(data.buildings.map((b) => b.size));
    assert.ok(sizes.size >= 2, `Expected mix of sizes, got: ${[...sizes].join(', ')}`);
  });

  it('all buildings are fully within map bounds', () => {
    // Check multiple seeds
    for (const seed of [1, 7, 42, 100, 999]) {
      const data = getBuildings(seed);
      for (const b of data.buildings) {
        assert.ok(b.x >= -0.01, `seed ${seed}: x=${b.x} outside map`);
        assert.ok(b.z >= -0.01, `seed ${seed}: z=${b.z} outside map`);
        assert.ok(b.x + b.w <= baseConfig.mapWidth + 0.01,
          `seed ${seed}: x+w=${(b.x + b.w).toFixed(2)} outside map width ${baseConfig.mapWidth}`);
        assert.ok(b.z + b.d <= baseConfig.mapDepth + 0.01,
          `seed ${seed}: z+d=${(b.z + b.d).toFixed(2)} outside map depth ${baseConfig.mapDepth}`);
      }
    }
  });

  it('all buildings are fully within their block', () => {
    for (const seed of [1, 42, 999]) {
      const data = getBuildings(seed);
      for (const b of data.buildings) {
        const block = data.blocks[b.blockIndex];
        assert.ok(b.x >= block.x - 0.01, `Building outside block minX`);
        assert.ok(b.z >= block.z - 0.01, `Building outside block minZ`);
        assert.ok(b.x + b.w <= block.x + block.w + 0.01, `Building outside block maxX`);
        assert.ok(b.z + b.d <= block.z + block.d + 0.01, `Building outside block maxZ`);
      }
    }
  });

  it('achieves roughly 70% coverage of block area', () => {
    // Average across seeds — should be near 70%
    let totalBlockArea = 0;
    let totalBuildingArea = 0;

    for (const seed of [1, 7, 42, 100, 999]) {
      const data = getBuildings(seed);
      for (const block of data.blocks) {
        totalBlockArea += block.w * block.d;
      }
      for (const b of data.buildings) {
        totalBuildingArea += b.w * b.d;
      }
    }

    const coverage = totalBuildingArea / totalBlockArea;
    assert.ok(coverage >= 0.5, `Coverage ${(coverage * 100).toFixed(1)}% too low (expected >= 50%)`);
    assert.ok(coverage <= 0.9, `Coverage ${(coverage * 100).toFixed(1)}% too high (expected <= 90%)`);
  });

  it('buildings do not overlap', () => {
    const data = getBuildings();
    for (let i = 0; i < data.buildings.length; i++) {
      for (let j = i + 1; j < data.buildings.length; j++) {
        const a = data.buildings[i];
        const b = data.buildings[j];
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapZ = a.z < b.z + b.d && a.z + a.d > b.z;
        assert.ok(!(overlapX && overlapZ), `Buildings ${i} and ${j} overlap`);
      }
    }
  });

  it('passes through grid data', () => {
    const data = getBuildings();
    assert.ok(Array.isArray(data.blocks));
    assert.ok(Array.isArray(data.streets));
  });
});
