import { describe, it, expect, afterEach } from 'vitest';
import { exportCollisionObj } from '../../src/export/collision-exporter.js';
import { buildCollisionObj } from '../../src/export/collision-buffer.js';
import { runStages } from '../helpers/run-stages.js';
import { mkdtemp, rm, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { vi } from 'vitest';

/** Minimal slab primitive in the shape produced by the geometry stage. */
function slab(name, x, y, z, w, h, d) {
  return { type: 'slab', name, x, y, z, w, h, d };
}

function makeGeometry() {
  return {
    version: 1,
    primitives: [
      slab('floor_f0_1_1', 0, -1, 0, 10, 1, 10),         // included
      slab('cover_0', 2, 0, 2, 2, 1, 2),                  // included
      slab('walkway_0', 0, 3, 0, 2, 0.25, 5),             // included
      slab('interior_cover_0', 1, 0, 1, 2, 1, 2),         // included
      slab('ladder_platform_0', 5, 3, 5, 2, 0.2, 2),      // included
      slab('deleted_courtyard_0', 6, 0, 6, 4, 0.3, 4),    // included
      slab('bridge_0', 0, 3, 0, 2, 0.5, 6),               // included (bridge deck)
      slab('bridge_wall_0', 0, 3.5, 0, 0.25, 1, 6),       // excluded (bridge wall)
      slab('bridge_batt_0', 0, 3.5, 0, 0.25, 2, 0.25),    // excluded (battlement)
      slab('wall_0', 0, 0, 0, 5, 1, 0.25),                // excluded
      { type: 'ceiling', name: 'roof_ceil_0_0', x: 0, y: 3, z: 0, w: 6, h: 1, d: 3 },   // excluded (ceiling type, not slab)
      { type: 'wall', name: 'wall_1', x: 0, y: 0, z: 0, w: 5, h: 1, d: 0.25 },           // excluded (not a slab)
      { type: 'ladder', name: 'ladder_path_0_0_0', x: 0, y0: 0, y1: 4, z: 0, w: 1, d: 0.25 }, // excluded
      { type: 'edges', name: 'floor_f0_1_1', x: 0, y: -1, z: 0, w: 10, h: 1, d: 10 },    // excluded (edge strips, not slab)
    ],
  };
}

describe('buildCollisionObj', () => {
  it('emits one box per collidable slab and ignores walls, ladders, ceilings and edge strips', () => {
    const { objString, count } = buildCollisionObj(makeGeometry());
    expect(count).toBe(7);
    for (const name of ['floor_f0_1_1', 'cover_0', 'walkway_0', 'interior_cover_0', 'ladder_platform_0', 'deleted_courtyard_0', 'bridge_0']) {
      expect(objString).toContain(`o ${name}\n`);
    }
    for (const name of ['wall_0', 'wall_1', 'bridge_wall_0', 'bridge_batt_0', 'roof_ceil_0_0', 'ladder_path_0_0_0']) {
      expect(objString).not.toContain(`o ${name}\n`);
    }
  });

  it('each box has 8 vertices and 12 triangles with valid indices', () => {
    const { objString, count } = buildCollisionObj(makeGeometry());
    const lines = objString.split('\n');
    const vCount = lines.filter(l => l.startsWith('v ')).length;
    const faces = lines.filter(l => l.startsWith('f '));
    expect(vCount).toBe(8 * count);
    expect(faces.length).toBe(12 * count);
    for (const f of faces) {
      const idx = f.split(' ').slice(1).map(Number);
      expect(idx.length).toBe(3);
      for (const i of idx) {
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(vCount);
      }
    }
  });

  it('box vertices span exactly the slab extents', () => {
    const { objString } = buildCollisionObj({ primitives: [slab('floor_a', 1, 2, 3, 4, 5, 6)] });
    const vs = objString.split('\n').filter(l => l.startsWith('v ')).map(l => l.split(' ').slice(1).map(Number));
    const min = [0, 1, 2].map(a => Math.min(...vs.map(v => v[a])));
    const max = [0, 1, 2].map(a => Math.max(...vs.map(v => v[a])));
    expect(min).toEqual([1, 2, 3]);
    expect(max).toEqual([5, 7, 9]);
  });

  it('returns count 0 for geometry with no collidable slabs', () => {
    expect(buildCollisionObj({ primitives: [slab('wall_0', 0, 0, 0, 1, 1, 1)] }).count).toBe(0);
  });

  it('real seed 42 geometry: only collidable prefixes appear, no walls or ladders', () => {
    const { objString, count } = buildCollisionObj(runStages(42).geometry);
    expect(count).toBeGreaterThan(0);
    const names = objString.split('\n').filter(l => l.startsWith('o ')).map(l => l.slice(2));
    expect(names.length).toBe(count);
    expect(names.some(n => n.startsWith('wall_'))).toBe(false);
    expect(names.some(n => n.startsWith('ladder_path_'))).toBe(false);
    expect(names.some(n => n.startsWith('roof_ceil_'))).toBe(false);
    expect(names.some(n => n.startsWith('floor_'))).toBe(true);
    expect(names.some(n => n.startsWith('cover_'))).toBe(true);
  });
});

describe('exportCollisionObj', () => {
  let tmpDir;
  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
    vi.restoreAllMocks();
  });

  it('writes <baseName>_collision.obj and returns its path', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    const result = await exportCollisionObj(makeGeometry(), tmpDir, 'test');
    expect(result).toBe(path.join(tmpDir, 'test_collision.obj'));
    const content = await readFile(result, 'utf-8');
    expect(content.startsWith('# Mordheim Collision Mesh')).toBe(true);
    expect(content).toContain('o floor_f0_1_1');
    expect(content).not.toContain('o wall_0');
  });

  it('returns null and writes nothing when no collidable slabs exist', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await exportCollisionObj({ primitives: [slab('wall_only', 0, 0, 0, 5, 3, 0.25)] }, tmpDir, 'test');
    expect(result).toBeNull();
  });
});
