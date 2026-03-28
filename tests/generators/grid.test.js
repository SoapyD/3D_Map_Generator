import { describe, it, expect } from 'vitest';
import { generateGrid } from '../../src/generators/grid.js';
import { createRng } from '../../src/core/rng.js';

const baseConfig = {
  mapWidth: 48,
  mapDepth: 48,
  streetWidth: 3.5,
};

describe('generateGrid', () => {
  it('returns blocks and streets arrays', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    expect(result).toHaveProperty('blocks');
    expect(result).toHaveProperty('streets');
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(Array.isArray(result.streets)).toBe(true);
  });

  it('produces at least 2 blocks for a 48x48 map', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    expect(result.blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('all blocks are within map bounds', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    for (const block of result.blocks) {
      expect(block.x).toBeGreaterThanOrEqual(0);
      expect(block.z).toBeGreaterThanOrEqual(0);
      expect(block.x + block.w).toBeLessThanOrEqual(baseConfig.mapWidth + 0.01);
      expect(block.z + block.d).toBeLessThanOrEqual(baseConfig.mapDepth + 0.01);
    }
  });

  it('blocks have positive dimensions', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    for (const block of result.blocks) {
      expect(block.w).toBeGreaterThan(0);
      expect(block.d).toBeGreaterThan(0);
    }
  });

  it('no two blocks overlap', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    const blocks = result.blocks;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        const overlaps = a.x < b.x + b.w && a.x + a.w > b.x &&
                         a.z < b.z + b.d && a.z + a.d > b.z;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('blocks have minimum size of 10 inches', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    for (const block of result.blocks) {
      expect(block.w).toBeGreaterThanOrEqual(9.9); // tiny float tolerance
      expect(block.d).toBeGreaterThanOrEqual(9.9);
    }
  });

  it('is deterministic with same seed', () => {
    const a = generateGrid(baseConfig, createRng(42));
    const b = generateGrid(baseConfig, createRng(42));
    expect(a.blocks.length).toBe(b.blocks.length);
    for (let i = 0; i < a.blocks.length; i++) {
      expect(a.blocks[i].x).toBeCloseTo(b.blocks[i].x);
      expect(a.blocks[i].z).toBeCloseTo(b.blocks[i].z);
    }
  });

  it('produces streets in negative space', () => {
    const rng = createRng(42);
    const result = generateGrid(baseConfig, rng);
    expect(result.streets.length).toBeGreaterThan(0);
    for (const street of result.streets) {
      expect(street.w).toBeGreaterThan(0);
      expect(street.d).toBeGreaterThan(0);
    }
  });

  it('handles a small map that cannot be split', () => {
    const smallConfig = { mapWidth: 15, mapDepth: 15, streetWidth: 3.5 };
    const rng = createRng(42);
    const result = generateGrid(smallConfig, rng);
    // Should still produce at least one block
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
  });
});
