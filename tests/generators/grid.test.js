import { describe, it, expect } from 'vitest';
import { generateGrid } from '../../src/generators/foundations/grid.js';
import { createRng } from '../../src/core/rng.js';
import { GRID } from '../../src/config.js';
import { rectsOverlap } from '../../src/core/rects-overlap.js';
import { makeConfig, quiet } from '../helpers/run-stages.js';

function grid(seed, overrides) {
  const config = makeConfig(seed, overrides);
  return { config, data: quiet(() => generateGrid(config, createRng(seed))) };
}

describe('generateGrid', () => {
  it('returns blocks, streetBounds, activeArea and skirt', () => {
    const { data } = grid(42);
    expect(Array.isArray(data.blocks)).toBe(true);
    expect(Array.isArray(data.streetBounds)).toBe(true);
    expect(data.activeArea).toMatchObject({ x: 0, z: 0, w: 48, d: 48 });
    expect(data.skirt).toBeDefined();
  });

  it('produces at least 2 blocks for a 48x48 map', () => {
    expect(grid(42).data.blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('all blocks are within the active area', () => {
    const { data } = grid(42);
    const a = data.activeArea;
    for (const b of data.blocks) {
      expect(b.x).toBeGreaterThanOrEqual(a.x);
      expect(b.z).toBeGreaterThanOrEqual(a.z);
      expect(b.x + b.w).toBeLessThanOrEqual(a.x + a.w + 1e-6);
      expect(b.z + b.d).toBeLessThanOrEqual(a.z + a.d + 1e-6);
    }
  });

  it('blocks are at least GRID.minBlockSize in both dimensions', () => {
    for (const b of grid(42).data.blocks) {
      expect(b.w).toBeGreaterThanOrEqual(GRID.minBlockSize);
      expect(b.d).toBeGreaterThanOrEqual(GRID.minBlockSize);
    }
  });

  it('no two blocks overlap', () => {
    const { blocks } = grid(42).data;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        expect(rectsOverlap(blocks[i], blocks[j])).toBe(false);
      }
    }
  });

  it('street bounds do not overlap any block', () => {
    const { blocks, streetBounds } = grid(42).data;
    for (const s of streetBounds) {
      for (const b of blocks) expect(rectsOverlap(s, b)).toBe(false);
    }
  });

  it('is deterministic with the same seed', () => {
    expect(grid(7).data).toEqual(grid(7).data);
  });

  it('different seeds give different layouts', () => {
    const layouts = [1, 2, 3, 4, 5].map(s => JSON.stringify(grid(s).data.blocks));
    expect(new Set(layouts).size).toBeGreaterThan(1);
  });

  it('seed 42 produces 9 blocks', () => {
    expect(grid(42).data.blocks.length).toBe(9);
  });
});
