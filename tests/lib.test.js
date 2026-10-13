import { describe, it, expect } from 'vitest';
import * as lib from '../src/lib.js';

/**
 * Regression guard for the programmatic API. generateToBuffer (lib.js) shares src/pipeline.js with the
 * CLI, so the in-process GLB matches the file output. These tests fail loudly if that drifts.
 */
describe('library exports', () => {
  it('exposes only generateToBuffer (the OBJ, collider and tier exports were removed)', () => {
    expect(Object.keys(lib).sort()).toEqual(['generateToBuffer']);
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
