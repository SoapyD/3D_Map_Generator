import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateToBuffer } from '../src/lib.js';

/**
 * Regression guard for the programmatic API. generateToBuffer (lib.js) used to
 * inline its own stage list, which drifted behind the CLI: it ran without the
 * collision matrix and skipped roofs/streets/ladders, so a matrix-dependent
 * stage (e.g. generateCover) threw and wyrdwars' /maps tab 500'd. lib.js now
 * shares src/pipeline.js with the CLI; these tests fail loudly if it regresses.
 */
describe('generateToBuffer (programmatic GLB API)', () => {
  it('runs the full pipeline and returns a valid GLB buffer', async () => {
    const buf = await generateToBuffer(42, { mapWidth: 48, mapDepth: 48 });
    assert.ok(Buffer.isBuffer(buf), 'expected a Buffer');
    assert.ok(buf.length > 1000, `expected a non-trivial GLB, got ${buf.length} bytes`);
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF', 'expected glTF magic header');
  });

  it('threads the seed through — different seeds yield different geometry', async () => {
    const [a, b] = await Promise.all([
      generateToBuffer(1, { mapWidth: 48, mapDepth: 48 }),
      generateToBuffer(2, { mapWidth: 48, mapDepth: 48 }),
    ]);
    assert.ok(!a.equals(b), 'different seeds should produce different GLB output');
  });
});
