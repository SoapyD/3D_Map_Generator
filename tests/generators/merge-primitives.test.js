import { describe, it, expect } from 'vitest';
import { runStages, quiet } from '../helpers/run-stages.js';
import { GEOMETRY } from '../../src/config.js';
import { buildGeometry } from '../../src/generators/geometry/index.js';
import { mergePrimitives } from '../../src/generators/geometry/merge-primitives.js';
import { mergeTwoBoxes } from '../../src/generators/geometry/merge/merge-two-boxes.js';
import { tierOf } from '../../src/export/assign-primitive-tier.js';
import { buildCollisionObj } from '../../src/export/collision-buffer.js';

const SEEDS = [42, 100, 7];
const EPS = 1e-6;
// The pass ships disabled (the greedy rect cover leaves nothing to merge); tests enable it explicitly.
const OPTS = { ...GEOMETRY.primitiveMerge, enabled: true };
const OFF = { ...OPTS, enabled: false };
const family = (name) => name.replace(/(_-?\d+)+$/, '');

/** Merged geometry (pass enabled) and the unmerged baseline for the same seed. */
function both(seed) {
  const r = runStages(seed);
  const merged = quiet(() => buildGeometry(r.cover, { ...r.config, primitiveMerge: OPTS })).primitives;
  const plain = quiet(() => buildGeometry(r.cover, { ...r.config, primitiveMerge: OFF })).primitives;
  return { r, merged, plain };
}

const isMergeable = (p) => p.type !== 'edges' && /^(wall_\d+$|pavement_\d+$|floor_f\d+_)/.test(p.name);

function volumeByKey(prims, config) {
  const out = {};
  for (const p of prims) {
    if (p.type !== 'slab' && p.type !== 'wall') continue;
    const key = `${p.type}|${p.textureKey}|${tierOf(p, config)}`;
    out[key] = (out[key] || 0) + p.w * p.h * p.d;
  }
  return out;
}

function overlapPairs(prims) {
  let n = 0;
  const c = prims.filter(isMergeable);
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) {
      const a = c[i], b = c[j];
      if (a.type !== b.type) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
      if (ox > EPS && oy > EPS && oz > EPS) n++;
    }
  }
  return n;
}

function collisionVolume(geometry) {
  let vol = 0, vs = [];
  const flush = () => {
    if (vs.length === 8) vol += (vs[6][0] - vs[0][0]) * (vs[6][1] - vs[0][1]) * (vs[6][2] - vs[0][2]);
    vs = [];
  };
  for (const line of buildCollisionObj(geometry).objString.split('\n')) {
    if (line.startsWith('o ')) flush();
    else if (line.startsWith('v ')) vs.push(line.slice(2).split(' ').map(Number));
  }
  flush();
  return vol;
}

describe('mergeTwoBoxes', () => {
  const r = (x, z, w, d) => ({ x, z, w, d });
  it('joins rectangles that share a full edge, in either order', () => {
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(3, 0, 4, 2), EPS)).toEqual(r(0, 0, 7, 2));
    expect(mergeTwoBoxes(r(3, 0, 4, 2), r(0, 0, 3, 2), EPS)).toEqual(r(0, 0, 7, 2));
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(0, 2, 3, 5), EPS)).toEqual(r(0, 0, 3, 7));
  });
  it('refuses overlaps, gaps, offsets and non-rectangular unions', () => {
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(2, 0, 3, 2), EPS)).toBeNull();
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(4, 0, 3, 2), EPS)).toBeNull();
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(3, 1, 3, 2), EPS)).toBeNull();
    expect(mergeTwoBoxes(r(0, 0, 3, 2), r(3, 0, 3, 3), EPS)).toBeNull();
  });
});

describe('mergePrimitives (synthetic)', () => {
  const slab = (name, x, z, w, d, extra = {}) => ({
    type: 'slab', name, x, y: -0.25, z, w, h: 0.25, d, textureKey: 'pavement:0',
    emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false, shared: true, ...extra,
  });
  const wall = (name, x, w, extra = {}) => ({
    type: 'wall', name, x, y: 0, z: 5, w, h: 3, d: 0.25, textureKey: 'wall:1', axis: 'x', ...extra,
  });

  it('returns the input untouched when disabled', () => {
    const prims = [slab('pavement_0', 0, 0, 3, 3), slab('pavement_1', 3, 0, 3, 3)];
    expect(mergePrimitives(prims, OFF)).toBe(prims);
  });

  it('merges pavements, keeps the first name and carries the first constituent as uvOrigin', () => {
    const out = mergePrimitives([slab('pavement_0', 0, 0, 3, 3), slab('pavement_1', 3, 0, 3, 3)], OPTS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'pavement_0', x: 0, w: 6, d: 3 });
    expect(out[0].uvOrigin).toEqual({ x: 0, y: -0.25, z: 0, w: 3, h: 0.25, d: 3 });
  });

  it('keeps the original uvOrigin through chains of merges', () => {
    const chain = [slab('pavement_0', 0, 0, 3, 3), slab('pavement_1', 3, 0, 3, 3), slab('pavement_2', 6, 0, 3, 3)];
    const out = mergePrimitives(chain, OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].w).toBe(9);
    expect(out[0].uvOrigin).toMatchObject({ x: 0, w: 3 });
  });

  it('never merges across texture, y, flags or floor-index families', () => {
    const f = (name, x, extra = {}) => slab(name, x, 0, 3, 3, { emitBottom: true, ...extra });
    expect(mergePrimitives([f('floor_f0_0_0', 0), f('floor_f1_3_0', 3)], OPTS)).toHaveLength(2);
    expect(mergePrimitives([f('floor_f0_0_0', 0), f('floor_f0_3_0', 3, { textureKey: 'floor:2' })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([f('floor_f0_0_0', 0), f('floor_f0_3_0', 3, { y: 2.75 })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([f('floor_f0_0_0', 0), f('floor_f0_3_0', 3, { rotateUV: true })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([f('floor_f0_0_0', 0), f('floor_f0_3_0', 3)], OPTS)).toHaveLength(1);
  });

  it('merges only collinear end-to-end walls with the same thickness, height and texture', () => {
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 3, 4)], OPTS)).toHaveLength(1);
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 3, 4, { z: 6 })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 3, 4, { d: 0.5 })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 3, 4, { textureKey: 'wall:2' })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 3, 4, { h: 2 })], OPTS)).toHaveLength(2);
    expect(mergePrimitives([wall('wall_0', 0, 3), wall('wall_1', 4, 4)], OPTS)).toHaveLength(2);
  });

  it('leaves excluded kinds (edges, bridge walls, battlements) alone', () => {
    const edge = (name, x) => ({ type: 'edges', name, x, y: 0, z: 0, w: 3, h: 1, d: 3, textureKey: 'pavement:0' });
    const prims = [
      edge('pavement_0', 0), edge('pavement_1', 3),
      slab('bridge_0_wallL', 0, 0, 3, 3, { shared: false }), slab('bridge_0_wallR', 3, 0, 3, 3, { shared: false }),
      slab('bridge_0_batt0_L', 6, 0, 3, 3, { shared: false }), slab('bridge_0_batt1_L', 9, 0, 3, 3, { shared: false }),
    ];
    expect(mergePrimitives(prims, OPTS)).toEqual(prims);
  });

  it('honours GEOMETRY.primitiveMerge.types', () => {
    const prims = [slab('pavement_0', 0, 0, 3, 3), slab('pavement_1', 3, 0, 3, 3)];
    expect(mergePrimitives(prims, { ...OPTS, types: ['wall'] })).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const prims = [slab('pavement_0', 0, 0, 3, 3), slab('pavement_1', 3, 0, 3, 3)];
    const copy = JSON.parse(JSON.stringify(prims));
    mergePrimitives(prims, OPTS);
    expect(prims).toEqual(copy);
  });
});

describe('mergePrimitives (generated maps)', () => {
  for (const seed of SEEDS) {
    describe(`seed ${seed}`, () => {
      const { r, merged, plain } = both(seed);

      it('never increases the primitive count', () => {
        expect(merged.length).toBeLessThanOrEqual(plain.length);
      });

      it('keeps per-texture, per-tier box volume unchanged', () => {
        const a = volumeByKey(plain, r.config), b = volumeByKey(merged, r.config);
        expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
        for (const k of Object.keys(a)) expect(b[k], k).toBeCloseTo(a[k], 6);
      });

      it('does not introduce overlapping rectangles', () => {
        expect(overlapPairs(merged)).toBeLessThanOrEqual(overlapPairs(plain));
      });

      it('keeps collidable volume unchanged', () => {
        expect(collisionVolume({ primitives: merged })).toBeCloseTo(collisionVolume({ primitives: plain }), 6);
      });

      it('keeps every merged primitive in the same tier as its constituents', () => {
        for (const m of merged) {
          if (!m.uvOrigin) continue;
          const parts = plain.filter((p) => p.type === m.type && family(p.name) === family(m.name) &&
            p.textureKey === m.textureKey && Math.abs(p.y - m.y) < EPS &&
            p.x >= m.x - EPS && p.x + p.w <= m.x + m.w + EPS && p.z >= m.z - EPS && p.z + p.d <= m.z + m.d + EPS);
          expect(parts.length).toBeGreaterThan(1);
          expect(parts.some((p) => p.x === m.uvOrigin.x && p.z === m.uvOrigin.z && p.name === m.name)).toBe(true);
          for (const p of parts) expect(tierOf(p, r.config)).toBe(tierOf(m, r.config));
        }
      });

      it('leaves every non-mergeable primitive identical and in order', () => {
        const rest = (list) => list.filter((p) => !isMergeable(p)).map((p) => JSON.stringify(p));
        expect(rest(merged)).toEqual(rest(plain));
      });

      it('is deterministic', () => {
        const again = quiet(() => buildGeometry(r.cover, r.config)).primitives;
        expect(again).toEqual(merged);
      });
    });
  }
});
