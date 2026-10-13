import { describe, it, expect } from 'vitest';
import { getObjOutputPath } from '../../src/export/obj-geometry/get-obj-output-path.js';
import { buildObjAndAtlas } from '../../src/export/obj-geometry/build-obj-and-atlas.js';
import { runStages, quiet } from '../helpers/run-stages.js';

const TTS_VERTEX_LIMIT = 25000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

describe('getObjOutputPath', () => {
  it('returns dir and a seed-based baseName from config', () => {
    const result = getObjOutputPath({ outputDir: 'output', seed: 42 });
    expect(result.dir).toBe('output');
    expect(result.baseName).toBe('mordheim_map_42');
  });
});

describe('buildObjAndAtlas (seed 42)', () => {
  const { geometry, config } = runStages(42);
  const { objString, atlasPngBuffer } = quiet(() => buildObjAndAtlas(geometry, config));
  const lines = objString.split('\n');
  const v = lines.filter(l => l.startsWith('v '));
  const vt = lines.filter(l => l.startsWith('vt '));
  const vn = lines.filter(l => l.startsWith('vn '));
  const f = lines.filter(l => l.startsWith('f '));

  it('produces OBJ vertex, uv, normal and face lines', () => {
    expect(v.length).toBeGreaterThan(0);
    expect(vt.length).toBeGreaterThan(0);
    expect(vn.length).toBeGreaterThan(0);
    expect(f.length).toBeGreaterThan(0);
  });

  it('stays under the 25k TTS vertex limit', () => {
    expect(v.length).toBeLessThan(TTS_VERTEX_LIMIT);
  });

  it('vertex lines are "v x y z" with finite numbers', () => {
    for (const line of v) {
      const p = line.split(' ');
      expect(p.length).toBe(4);
      for (const n of p.slice(1)) expect(Number.isFinite(parseFloat(n))).toBe(true);
    }
  });

  it('every face index references an existing vertex, uv and normal', () => {
    for (const line of f) {
      for (const tok of line.split(' ').slice(1)) {
        const [vi, ti, ni] = tok.split('/').map(Number);
        expect(vi).toBeGreaterThanOrEqual(1);
        expect(vi).toBeLessThanOrEqual(v.length);
        if (!Number.isNaN(ti)) {
          expect(ti).toBeGreaterThanOrEqual(1);
          expect(ti).toBeLessThanOrEqual(vt.length);
        }
        if (!Number.isNaN(ni)) {
          expect(ni).toBeGreaterThanOrEqual(1);
          expect(ni).toBeLessThanOrEqual(vn.length);
        }
      }
    }
  });

  it('UV coordinates fall inside the 0-1 atlas range', () => {
    for (const line of vt) {
      const [u, w] = line.split(' ').slice(1).map(parseFloat);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it('returns a PNG atlas buffer', () => {
    expect(Buffer.isBuffer(atlasPngBuffer)).toBe(true);
    expect([...atlasPngBuffer.subarray(0, 4)]).toEqual(PNG_MAGIC);
  });

  it('is deterministic: building twice yields identical OBJ text', () => {
    const again = quiet(() => buildObjAndAtlas(geometry, config));
    expect(again.objString).toBe(objString);
  });

  it('seed 42 vertex count is locked', () => {
    expect(v.length).toMatchInlineSnapshot(`20196`);
  });
});
