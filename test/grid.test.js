import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateGrid } from '../src/generators/grid.js';

const baseConfig = { mapWidth: 48, mapDepth: 48, streetWidth: 3.5 };

describe('Grid Generator', () => {
  it('produces at least 2 blocks for a standard map', () => {
    const rng = createRng(42);
    const { blocks } = generateGrid(baseConfig, rng);
    assert.ok(blocks.length >= 2, `Expected >= 2 blocks, got ${blocks.length}`);
  });

  it('all blocks are within map bounds', () => {
    const rng = createRng(42);
    const { blocks } = generateGrid(baseConfig, rng);
    for (const b of blocks) {
      assert.ok(b.x >= 0, `Block x=${b.x} is out of bounds`);
      assert.ok(b.z >= 0, `Block z=${b.z} is out of bounds`);
      assert.ok(b.x + b.w <= baseConfig.mapWidth + 0.01, `Block extends past map width`);
      assert.ok(b.z + b.d <= baseConfig.mapDepth + 0.01, `Block extends past map depth`);
    }
  });

  it('blocks do not overlap', () => {
    const rng = createRng(42);
    const { blocks } = generateGrid(baseConfig, rng);
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapZ = a.z < b.z + b.d && a.z + a.d > b.z;
        assert.ok(!(overlapX && overlapZ), `Blocks ${i} and ${j} overlap`);
      }
    }
  });

  it('is deterministic with the same seed', () => {
    const r1 = createRng(123);
    const r2 = createRng(123);
    const g1 = generateGrid(baseConfig, r1);
    const g2 = generateGrid(baseConfig, r2);
    assert.deepStrictEqual(g1.blocks, g2.blocks);
  });

  it('produces different results with different seeds', () => {
    const r1 = createRng(1);
    const r2 = createRng(999);
    const g1 = generateGrid(baseConfig, r1);
    const g2 = generateGrid(baseConfig, r2);
    // Very unlikely to produce identical layouts
    assert.notDeepStrictEqual(g1.blocks, g2.blocks);
  });
});
