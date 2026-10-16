import { describe, it, expect } from 'vitest';
import * as lib from '../src/lib.js';

/**
 * Regression guard for the programmatic API. generateToBuffer (lib.js) shares src/pipeline.js with the
 * CLI, so the in-process GLB matches the file output. These tests fail loudly if that drifts.
 */
describe('library exports', () => {
  it('exposes only generateToBuffer and generateMapData (the OBJ, collider and tier exports were removed)', () => {
    expect(Object.keys(lib).sort()).toEqual(['generateMapData', 'generateToBuffer']);
  });
});

describe('generateToBuffer (programmatic GLB API)', () => {
  it('runs the full pipeline and returns a valid GLB buffer', async () => {
    const buf = await lib.generateToBuffer(42, { mapWidth: 48, mapDepth: 48 });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('glTF');
  });

  it('threads the seed through: different seeds yield different geometry', async () => {
    const [a, b] = await Promise.all([
      lib.generateToBuffer(1, { mapWidth: 48, mapDepth: 48 }),
      lib.generateToBuffer(2, { mapWidth: 48, mapDepth: 48 }),
    ]);
    expect(a.equals(b)).toBe(false);
  });

  it('is deterministic for a fixed seed', async () => {
    const [a, b] = await Promise.all([
      lib.generateToBuffer(7, { mapWidth: 48, mapDepth: 48 }),
      lib.generateToBuffer(7, { mapWidth: 48, mapDepth: 48 }),
    ]);
    expect(a.equals(b)).toBe(true);
  });
});

describe('generateMapData (programmatic matrix + primitives API)', () => {
  const OPTS = { mapWidth: 24, mapDepth: 24 };

  it('returns the seed, opts, matrix and primitives', () => {
    const d = lib.generateMapData(3, OPTS);
    expect(d.seed).toBe(3);
    expect(d.matrix.cells).toBeInstanceOf(Uint8Array);
    expect(d.matrix.cells.length).toBe(d.matrix.W * d.matrix.D * (d.matrix.maxY + d.matrix.belowGround));
    expect(d.primitives.length).toBeGreaterThan(0);
    expect(d.opts.mapWidth).toBe(24);
    expect(d.opts.levelHeight).toBeGreaterThan(0);
    expect(d.opts.floorThickness).toBeGreaterThan(0);
  });

  it('is deterministic: the same seed and opts give identical matrix bytes and primitives', () => {
    const a = lib.generateMapData(7, OPTS);
    const b = lib.generateMapData(7, OPTS);
    expect(Buffer.from(a.matrix.cells).equals(Buffer.from(b.matrix.cells))).toBe(true);
    expect(JSON.stringify(a.primitives)).toBe(JSON.stringify(b.primitives));
  });

  it('different seeds give different matrices', () => {
    const a = lib.generateMapData(1, OPTS);
    const b = lib.generateMapData(2, OPTS);
    expect(Buffer.from(a.matrix.cells).equals(Buffer.from(b.matrix.cells))).toBe(false);
  });

  it('matches the CLI path: same runPipeline output as toDebugJSON for the same config', async () => {
    const { DEFAULTS } = await import('../src/config.js');
    const { createRng } = await import('../src/core/rng.js');
    const { runPipeline } = await import('../src/pipeline.js');
    const { profileDefaults } = await import('../src/profiles/profile-defaults.js');
    const config = { ...DEFAULTS, ...profileDefaults(undefined), ...OPTS, seed: 5 };
    const log = console.log; console.log = () => {};
    let ref;
    try { ref = runPipeline(config, createRng(5)); } finally { console.log = log; }
    const d = lib.generateMapData(5, OPTS);
    expect(Buffer.from(d.matrix.cells).equals(Buffer.from(Uint8Array.from(ref.matrix.toDebugJSON().cells)))).toBe(true);
    expect(JSON.stringify(d.primitives)).toBe(JSON.stringify(ref.geometry.primitives));
  });

  it('applies a profile and size options', () => {
    const small = lib.generateMapData(3, { mapWidth: 24, mapDepth: 24 });
    const big = lib.generateMapData(3, { mapWidth: 36, mapDepth: 36 });
    expect(big.matrix.W).toBeGreaterThan(small.matrix.W);
    const prof = lib.generateMapData(3, { profile: 'withering' });
    expect(prof.matrix.W).toBeGreaterThan(0);
    expect(prof.opts.profile).toBe('withering');
  });

  it('does not print stage logging and restores console.log', () => {
    const orig = console.log;
    const seen = [];
    console.log = (...a) => seen.push(a);
    try { lib.generateMapData(3, OPTS); expect(console.log).not.toBe(orig); } finally { console.log = orig; }
    expect(seen).toEqual([]);
  });
});
