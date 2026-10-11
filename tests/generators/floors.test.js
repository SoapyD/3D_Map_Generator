import { describe, it, expect } from 'vitest';
import { runStages } from '../helpers/run-stages.js';

const SEEDS = [42, 100, 7];

function inside(r, b) {
  return r.x >= b.x && r.z >= b.z && r.x + r.w <= b.x + b.w + 1e-6 && r.z + r.d <= b.z + b.d + 1e-6;
}

describe('generateFloors', () => {
  it('returns floors and roofSlabs arrays', () => {
    const { floors } = runStages(42);
    expect(floors.floors.length).toBeGreaterThan(0);
    expect(floors.roofSlabs.length).toBeGreaterThan(0);
  });

  it('every building gets exactly one roof slab', () => {
    for (const seed of SEEDS) {
      const { floors } = runStages(seed);
      expect(floors.roofSlabs.length).toBe(floors.buildings.length);
      const idx = floors.roofSlabs.map(r => r.buildingIndex).sort((a, b) => a - b);
      expect(idx).toEqual(floors.buildings.map((_, i) => i));
    }
  });

  it('floor count per building is maxTier - 1', () => {
    for (const seed of SEEDS) {
      const { floors } = runStages(seed);
      floors.buildings.forEach((b, i) => {
        const n = floors.floors.filter(f => f.buildingIndex === i).length;
        expect(n, `seed ${seed} building ${i}`).toBe(b.maxTier - 1);
      });
    }
  });

  it('floor slabs sit on tier boundaries (stride = tierHeight + slabThickness)', () => {
    const { floors, config } = runStages(42);
    const stride = config.tierHeight + config.slabThickness;
    for (const f of floors.floors) {
      expect((f.yCollisionLevel + config.slabThickness) % stride).toBe(0);
    }
  });

  it('ground floors start at -slabThickness', () => {
    const { floors, config } = runStages(42);
    for (const f of floors.floors.filter(f => f.floorIndex === 0)) {
      expect(f.yCollisionLevel).toBe(-config.slabThickness);
    }
  });

  it('floor rects have positive size and stay within the building footprint', () => {
    for (const seed of SEEDS) {
      const { floors } = runStages(seed);
      for (const f of [...floors.floors, ...floors.roofSlabs]) {
        const b = floors.buildings[f.buildingIndex];
        for (const r of f.rects) {
          expect(r.w).toBeGreaterThan(0);
          expect(r.d).toBeGreaterThan(0);
          expect(inside(r, b), `seed ${seed} ${f.buildingId}`).toBe(true);
        }
      }
    }
  });

  it('removedQuadrants are valid indexes (0-3) without duplicates', () => {
    const { floors } = runStages(42);
    for (const f of [...floors.floors, ...floors.roofSlabs]) {
      for (const q of f.removedQuadrants) expect([0, 1, 2, 3]).toContain(q);
      expect(new Set(f.removedQuadrants).size).toBe(f.removedQuadrants.length);
    }
  });

  it('total removed quadrants never decrease as damageLevel rises from 0 to 1 (summed over seeds)', () => {
    const removed = (lvl) => {
      let n = 0;
      for (const seed of SEEDS) {
        n += runStages(seed, { damageLevel: lvl }).floors.floors.reduce((s, f) => s + f.removedQuadrants.length, 0);
      }
      return n;
    };
    expect(removed(0)).toBeLessThanOrEqual(removed(1));
  });

  it('is deterministic for the same seed (separate generation runs)', () => {
    const a = runStages(42);
    const b = runStages(42, { textureSet: 'base' });
    expect(a).not.toBe(b);
    expect(a.floors.floors).toEqual(b.floors.floors);
  });
});
