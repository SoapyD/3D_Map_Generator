import { describe, it, expect } from 'vitest';
import { DEFAULTS, BUILDINGS, CONNECTIVITY, COVER, GRID, LADDERS, parseArgs } from '../../src/config.js';
import { createRng } from '../../src/core/rng.js';
import { createCollisionMatrix } from '../../src/generators/collision/matrix.js';
import { generateGrid } from '../../src/generators/foundations/grid.js';
import { generateBuildings } from '../../src/generators/buildings/index.js';
import { runPipeline } from '../../src/pipeline.js';
import { applyProfile } from '../../src/profiles/apply-profile.js';
import { getProfile } from '../../src/profiles/get-profile.js';
import { profileDefaults } from '../../src/profiles/profile-defaults.js';
import { quiet, runStages } from '../helpers/run-stages.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function witheringConfig(seed) {
  return { ...DEFAULTS, ...profileDefaults('withering'), profile: 'withering', seed };
}

/** Stage 1 + 2 only, with the profile applied for the duration. */
function gridAndBuildings(seed) {
  const config = witheringConfig(seed);
  const restore = applyProfile(config);
  try {
    return quiet(() => {
      const rng = createRng(seed);
      const grid = generateGrid(config, rng);
      const matrix = createCollisionMatrix(grid.activeArea, config.tiers, config);
      return generateBuildings(grid, config, rng, matrix);
    });
  } finally {
    restore();
  }
}

describe('withering profile', () => {
  it('is a small 4-level map (ground + tiers 1-3)', () => {
    const cfg = witheringConfig(1);
    expect(cfg.mapWidth).toBeLessThan(DEFAULTS.mapWidth);
    expect(cfg.mapDepth).toBeLessThan(DEFAULTS.mapDepth);
    expect(cfg.tiers).toBe(4);
  });

  it('places at most one building per block', () => {
    for (const seed of SEEDS) {
      const { blocks, buildings } = gridAndBuildings(seed);
      expect(blocks.length, `seed ${seed} blocks`).toBeGreaterThanOrEqual(6);
      const perBlock = new Map();
      for (const b of buildings) perBlock.set(b.blockIndex, (perBlock.get(b.blockIndex) ?? 0) + 1);
      expect([...perBlock.values()].every(n => n === 1), `seed ${seed}`).toBe(true);
      expect(perBlock.size, `seed ${seed} built blocks`).toBeLessThanOrEqual(blocks.length);
    }
  });

  it('uses a ruin only in blocks too thin (4") for anything bigger', () => {
    for (const seed of SEEDS) {
      const { blocks, buildings } = gridAndBuildings(seed);
      for (const b of buildings.filter(x => x.size === 'ruins-small')) {
        const block = blocks[b.blockIndex];
        expect(Math.min(block.w, block.d), `seed ${seed} block ${b.blockIndex}`).toBeLessThan(8);
      }
    }
  });

  it('never builds above ground + tiers 1-3 (floors and roofs top out at 12")', () => {
    for (const seed of SEEDS) {
      const { geometry } = quiet(() => runPipeline(witheringConfig(seed), createRng(seed)));
      const tops = geometry.primitives
        .filter(p => p.type === 'slab' && /floor|roof/i.test(p.name))
        .map(p => p.y + p.h);
      expect(Math.max(...tops), `seed ${seed}`).toBeLessThanOrEqual(12);
    }
  });

  it('has far fewer objects than the default profile on the same seed', () => {
    const slim = quiet(() => runPipeline(witheringConfig(5), createRng(5))).geometry.primitives.length;
    const full = quiet(() => runPipeline({ ...DEFAULTS, seed: 5 }, createRng(5))).geometry.primitives.length;
    expect(slim).toBeLessThan(full / 2);
  });

  it('lets connections span up to the full map, never more', () => {
    const cfg = witheringConfig(1);
    const restore = applyProfile(cfg);
    try {
      expect(CONNECTIVITY.maxLengthMapFraction).toBe(1);
    } finally {
      restore();
    }
    let longest = 0;
    for (const seed of SEEDS) {
      const { connectivity } = runStages(seed, { profile: 'withering' });
      for (const c of connectivity.connections.candidates) longest = Math.max(longest, c.length);
    }
    expect(longest).toBeLessThanOrEqual(cfg.mapWidth);
  });

  it('is deterministic for a seed', () => {
    const count = () => quiet(() => runPipeline(witheringConfig(9), createRng(9))).geometry.primitives.length;
    expect(count()).toBe(count());
  });

  it('restores the shared config sections after a run', () => {
    quiet(() => runPipeline(witheringConfig(3), createRng(3)));
    expect(BUILDINGS.mode).toBe('fill');
    expect(BUILDINGS.emptyBlocks).toEqual({ min: 0, max: 0 });
    expect(COVER.shellChance).toBe(1);
    expect(GRID.strategy).toBe('random');
    expect(CONNECTIVITY.maxLengthMapFraction).toBe(0.5);
    expect(LADDERS.pathQuota.largeA).toBe(3);
  });

  it('restores sections even when the pipeline throws', () => {
    const config = { ...witheringConfig(3), mapWidth: NaN, mapDepth: NaN };
    try { quiet(() => runPipeline(config, createRng(3))); } catch { /* expected or not; only restoration matters */ }
    expect(BUILDINGS.mode).toBe('fill');
  });
});

describe('profile plumbing', () => {
  it('--profile sets the defaults but explicit flags still win', () => {
    const cfg = parseArgs(['node', 'index.js', '--profile', 'withering', '--size', '32x32']);
    expect(cfg.profile).toBe('withering');
    expect(cfg.mapDepth).toBe(32); // profile default (the explicit --size only set the width)
    expect(cfg.mapWidth).toBe(32);
  });

  it('no profile leaves the defaults alone', () => {
    const cfg = parseArgs(['node', 'index.js', '--seed', '1']);
    expect(cfg.profile).toBeNull();
    expect(cfg.tiers).toBe(DEFAULTS.tiers);
  });

  it('an unknown profile name is an error that lists the valid ones', () => {
    expect(() => getProfile('nope')).toThrow(/withering/);
  });
});

describe('GRID.minBlockSize override', () => {
  it('takes effect at run time (smaller minimum gives more, smaller blocks) and restores cleanly', () => {
    const blocksAt = (min) => {
      const original = GRID.minBlockSize;
      GRID.minBlockSize = min;
      try {
        return quiet(() => generateGrid({ ...DEFAULTS, mapWidth: 32, mapDepth: 32, seed: 1 }, createRng(1))).blocks;
      } finally {
        GRID.minBlockSize = original;
      }
    };
    expect(blocksAt(4).length).toBeGreaterThan(blocksAt(8).length);
    expect(GRID.minBlockSize).toBe(8);
  });
});
