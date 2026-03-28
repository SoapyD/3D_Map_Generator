import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';

describe('createRng', () => {
  describe('determinism', () => {
    it('produces identical sequences for the same seed', () => {
      const a = createRng(42);
      const b = createRng(42);
      for (let i = 0; i < 100; i++) {
        expect(a.random()).toBe(b.random());
      }
    });

    it('produces different sequences for different seeds', () => {
      const a = createRng(42);
      const b = createRng(99);
      const aVals = Array.from({ length: 10 }, () => a.random());
      const bVals = Array.from({ length: 10 }, () => b.random());
      expect(aVals).not.toEqual(bVals);
    });

    it('seed 0 does not degenerate', () => {
      const rng = createRng(0);
      const vals = Array.from({ length: 20 }, () => rng.random());
      const unique = new Set(vals);
      expect(unique.size).toBeGreaterThan(15);
    });
  });

  describe('random()', () => {
    it('returns values in [0, 1)', () => {
      const rng = createRng(42);
      for (let i = 0; i < 1000; i++) {
        const v = rng.random();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('int(min, max)', () => {
    it('returns integers within [min, max] inclusive', () => {
      const rng = createRng(42);
      const results = new Set();
      for (let i = 0; i < 1000; i++) {
        const v = rng.int(3, 7);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
        expect(Number.isInteger(v)).toBe(true);
        results.add(v);
      }
      // With 1000 samples, all values 3-7 should appear
      expect(results.size).toBe(5);
    });

    it('works when min equals max', () => {
      const rng = createRng(42);
      for (let i = 0; i < 10; i++) {
        expect(rng.int(5, 5)).toBe(5);
      }
    });
  });

  describe('float(min, max)', () => {
    it('returns floats within [min, max)', () => {
      const rng = createRng(42);
      for (let i = 0; i < 1000; i++) {
        const v = rng.float(2.5, 8.5);
        expect(v).toBeGreaterThanOrEqual(2.5);
        expect(v).toBeLessThan(8.5);
      }
    });
  });

  describe('chance(probability)', () => {
    it('always returns false for probability 0', () => {
      const rng = createRng(42);
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });

    it('always returns true for probability 1', () => {
      const rng = createRng(42);
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('returns roughly expected ratio for 0.5', () => {
      const rng = createRng(42);
      let trueCount = 0;
      const n = 10000;
      for (let i = 0; i < n; i++) {
        if (rng.chance(0.5)) trueCount++;
      }
      const ratio = trueCount / n;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
    });
  });

  describe('pick(array)', () => {
    it('returns an element from the array', () => {
      const rng = createRng(42);
      const arr = ['a', 'b', 'c', 'd'];
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it('eventually picks every element', () => {
      const rng = createRng(42);
      const arr = [1, 2, 3];
      const seen = new Set();
      for (let i = 0; i < 100; i++) {
        seen.add(rng.pick(arr));
      }
      expect(seen.size).toBe(3);
    });
  });

  describe('shuffle(array)', () => {
    it('preserves all elements', () => {
      const rng = createRng(42);
      const arr = [1, 2, 3, 4, 5];
      const copy = [...arr];
      rng.shuffle(copy);
      expect(copy.sort()).toEqual(arr.sort());
    });

    it('is deterministic', () => {
      const a = createRng(42);
      const b = createRng(42);
      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr2 = [...arr1];
      a.shuffle(arr1);
      b.shuffle(arr2);
      expect(arr1).toEqual(arr2);
    });

    it('returns the same array reference', () => {
      const rng = createRng(42);
      const arr = [1, 2, 3];
      const result = rng.shuffle(arr);
      expect(result).toBe(arr);
    });
  });
});
