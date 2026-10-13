import { describe, it, expect } from 'vitest';
import { runStages } from '../helpers/run-stages.js';
import { levelHeight } from '../../src/core/levels.js';

const SEEDS = [42, 100, 7];
const COVER_HEIGHTS = [1, 2]; // short / tall pieces (docs/processes/pipeline-flows/9-cover.md)

function overlapsXZ(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
}

describe('generateCover', () => {
  it('returns cover, streetScatter and freeSpace', () => {
    const { cover } = runStages(42);
    expect(cover.cover.length).toBeGreaterThan(0);
    expect(cover.streetScatter.length).toBeGreaterThan(0);
    expect(cover.freeSpace).toMatchObject({ shells: expect.anything(), roofs: expect.anything(), streets: expect.anything() });
  });

  it('cover pieces have numeric position and size', () => {
    for (const c of [...runStages(42).cover.cover, ...runStages(42).cover.streetScatter]) {
      for (const key of ['x', 'y', 'z', 'w', 'd', 'height']) expect(typeof c[key], key).toBe('number');
    }
  });

  it('cover pieces are within the active area', () => {
    for (const seed of SEEDS) {
      const { cover, grid } = runStages(seed);
      const a = grid.activeArea;
      for (const c of [...cover.cover, ...cover.streetScatter]) {
        expect(c.x).toBeGreaterThanOrEqual(a.x);
        expect(c.z).toBeGreaterThanOrEqual(a.z);
        expect(c.x + c.w).toBeLessThanOrEqual(a.x + a.w);
        expect(c.z + c.d).toBeLessThanOrEqual(a.z + a.d);
      }
    }
  });

  it('cover heights are only the configured piece heights (1 or 2)', () => {
    for (const seed of SEEDS) {
      const { cover } = runStages(seed);
      for (const c of [...cover.cover, ...cover.streetScatter]) {
        expect(COVER_HEIGHTS).toContain(c.height);
      }
    }
  });

  it('cover footprints are 2x2, 2x3 or 3x2', () => {
    for (const seed of SEEDS) {
      const { cover } = runStages(seed);
      for (const c of [...cover.cover, ...cover.streetScatter]) {
        expect(['2x2', '2x3', '3x2']).toContain(`${c.w}x${c.d}`);
      }
    }
  });

  it('street scatter sits on the ground (y = 0)', () => {
    for (const seed of SEEDS) {
      for (const c of runStages(seed).cover.streetScatter) expect(c.y).toBe(0);
    }
  });

  it('street scatter lies inside a street corridor', () => {
    for (const seed of SEEDS) {
      const { cover, streets } = runStages(seed);
      for (const c of cover.streetScatter) {
        const hit = streets.streets.some(s => c.x >= s.x && c.z >= s.z && c.x + c.w <= s.x + s.w && c.z + c.d <= s.z + s.d);
        expect(hit, `seed ${seed} scatter at ${c.x},${c.z}`).toBe(true);
      }
    }
  });

  it('cover rests on a tier surface (y is a multiple of the tier stride)', () => {
    const { cover, config } = runStages(42);
    const stride = levelHeight(config);
    for (const c of cover.cover) expect(c.y % stride).toBe(0);
  });

  it('cover on the same level never overlaps other cover', () => {
    for (const seed of SEEDS) {
      const all = [...runStages(seed).cover.cover, ...runStages(seed).cover.streetScatter];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          if (all[i].y !== all[j].y) continue;
          expect(overlapsXZ(all[i], all[j]), `seed ${seed}: ${i} vs ${j}`).toBe(false);
        }
      }
    }
  });

  it('no cover overlaps a kept ladder segment', () => {
    for (const seed of SEEDS) {
      const { cover, ladders } = runStages(seed);
      const segs = ladders.ladderPaths.flatMap(p => p.segments).filter(s => s.keptTopY > s.keptBottomY);
      for (const c of [...cover.cover, ...cover.streetScatter]) {
        for (const s of segs) {
          const verticalOverlap = c.y < s.keptTopY && c.y + c.height > s.keptBottomY;
          expect(overlapsXZ(c, s) && verticalOverlap, `seed ${seed}: cover ${c.x},${c.z} vs ladder ${s.x},${s.z}`).toBe(false);
        }
      }
    }
  });

  it('cover geometry primitives use the cover_ and street_scatter_ name prefixes', () => {
    const { geometry, cover } = runStages(42);
    const names = geometry.primitives.filter(p => p.type === 'slab').map(p => p.name);
    expect(names.filter(n => n.startsWith('cover_')).length).toBe(cover.cover.length);
    expect(names.filter(n => n.startsWith('street_scatter_')).length).toBe(cover.streetScatter.length);
  });

  it('is deterministic for the same seed (separate generation runs)', () => {
    const a = runStages(42);
    const b = runStages(42, { textureSet: 'base' });
    expect(a).not.toBe(b);
    expect(a.cover.cover).toEqual(b.cover.cover);
    expect(a.cover.streetScatter).toEqual(b.cover.streetScatter);
  });
});
