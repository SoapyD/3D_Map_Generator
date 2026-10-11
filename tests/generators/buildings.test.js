import { describe, it, expect } from 'vitest';
import { runStages } from '../helpers/run-stages.js';
import { BUILDING_SIZES } from '../../src/generators/buildings/building-sizes.js';
import { rectsOverlap } from '../../src/core/rects-overlap.js';

const SEEDS = [42, 100, 7];

describe('generateBuildings', () => {
  it('returns a buildings array and carries grid fields forward', () => {
    const { buildings } = runStages(42);
    expect(buildings.buildings.length).toBeGreaterThan(0);
    expect(buildings.blocks).toBeDefined();
    expect(buildings.activeArea).toBeDefined();
  });

  it('every building has required properties and positive dimensions', () => {
    for (const seed of SEEDS) {
      for (const b of runStages(seed).buildings.buildings) {
        expect(b).toMatchObject({ x: expect.any(Number), z: expect.any(Number), size: expect.any(String), maxTier: expect.any(Number) });
        expect(b.w).toBeGreaterThan(0);
        expect(b.d).toBeGreaterThan(0);
      }
    }
  });

  it('building size names are known and footprints match BUILDING_SIZES', () => {
    for (const seed of SEEDS) {
      for (const b of runStages(seed).buildings.buildings) {
        const def = BUILDING_SIZES[b.size];
        expect(def, `unknown size ${b.size}`).toBeDefined();
        expect(b.w).toBe(def.footprintW);
        expect(b.d).toBe(def.footprintD);
      }
    }
  });

  it('maxTier is between 2 and config.tiers', () => {
    for (const seed of SEEDS) {
      const { buildings, config } = runStages(seed);
      for (const b of buildings.buildings) {
        expect(b.maxTier).toBeGreaterThanOrEqual(2);
        expect(b.maxTier).toBeLessThanOrEqual(config.tiers);
      }
    }
  });

  it('each building sits inside the block it references', () => {
    for (const seed of SEEDS) {
      const { buildings } = runStages(seed);
      for (const b of buildings.buildings) {
        const block = buildings.blocks[b.blockIndex];
        expect(b.x).toBeGreaterThanOrEqual(block.x);
        expect(b.z).toBeGreaterThanOrEqual(block.z);
        expect(b.x + b.w).toBeLessThanOrEqual(block.x + block.w);
        expect(b.z + b.d).toBeLessThanOrEqual(block.z + block.d);
      }
    }
  });

  it('buildings do not overlap each other', () => {
    for (const seed of SEEDS) {
      const list = runStages(seed).buildings.buildings;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(rectsOverlap(list[i], list[j]), `seed ${seed}: ${i} vs ${j}`).toBe(false);
        }
      }
    }
  });

  it('buildings are within map bounds', () => {
    const { buildings, config } = runStages(42);
    for (const b of buildings.buildings) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.z).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(config.mapWidth);
      expect(b.z + b.d).toBeLessThanOrEqual(config.mapDepth);
    }
  });

  it('is deterministic for the same seed (separate generation runs)', () => {
    // Different cache key (extra option that does not affect generation) forces a fresh run.
    const a = runStages(42);
    const b = runStages(42, { textureSet: 'base' });
    expect(a).not.toBe(b);
    expect(a.buildings.buildings).toEqual(b.buildings.buildings);
  });

  it('seed 42 produces 24 buildings', () => {
    expect(runStages(42).buildings.buildings.length).toBe(24);
  });
});
