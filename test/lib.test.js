import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateToBuffer, generateObjToBuffers, generateColliderToBuffer } from '../src/lib.js';

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

describe('generateObjToBuffers (programmatic OBJ + atlas API for Tabletop Simulator)', () => {
  it('returns an OBJ string (with UVs + normals) and a valid PNG atlas buffer', async () => {
    const { objString, atlasPngBuffer } = await generateObjToBuffers(42, { mapWidth: 48, mapDepth: 48 });
    assert.equal(typeof objString, 'string');
    assert.ok(/^v /m.test(objString), 'expected vertices');
    assert.ok(/^vt /m.test(objString), 'expected UVs (vt) mapping into the atlas diffuse');
    assert.ok(/^vn /m.test(objString), 'expected normals (vn)');
    assert.ok(/^f /m.test(objString), 'expected faces');
    assert.ok(Buffer.isBuffer(atlasPngBuffer) && atlasPngBuffer.length > 100, 'expected a PNG buffer');
    assert.equal(atlasPngBuffer[0], 0x89, 'expected PNG magic byte');
    assert.equal(atlasPngBuffer.subarray(1, 4).toString('ascii'), 'PNG', 'expected PNG signature');
  });

  it('threads the seed through — different seeds yield different OBJ', async () => {
    const [a, b] = await Promise.all([
      generateObjToBuffers(1, { mapWidth: 48, mapDepth: 48 }),
      generateObjToBuffers(2, { mapWidth: 48, mapDepth: 48 }),
    ]);
    assert.notEqual(a.objString, b.objString, 'different seeds should produce different OBJ');
  });
});

describe('generateColliderToBuffer (programmatic collider OBJ for Tabletop Simulator)', () => {
  it('returns a collider OBJ of box surfaces — distinct from the visual mesh (no UVs)', async () => {
    const obj = await generateColliderToBuffer(42, { mapWidth: 48, mapDepth: 48 });
    assert.equal(typeof obj, 'string');
    assert.ok(/^o /m.test(obj), 'expected named collidable surfaces');
    assert.ok(/^v /m.test(obj) && /^f /m.test(obj), 'expected box verts + faces');
    assert.ok(!/^vt /m.test(obj), 'collider must NOT carry UVs (simplified collision mesh)');
  });
});
