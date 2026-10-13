import { describe, it, expect } from 'vitest';
import { runStages } from '../helpers/run-stages.js';
import { WALL } from '../../src/config.js';
import { levelHeight, wallGeomHeight, floorThickness } from '../../src/core/levels.js';

const SEEDS = [42, 100, 7];
const EPS = 1e-6;

describe('generateWalls', () => {
  it('returns walls and internalWalls arrays', () => {
    const { walls } = runStages(42);
    expect(walls.walls.length).toBeGreaterThan(0);
    expect(Array.isArray(walls.internalWalls)).toBe(true);
  });

  it('all walls have required properties', () => {
    for (const w of runStages(42).walls.walls) {
      for (const key of ['x', 'y', 'z', 'w', 'h', 'd', 'floorY']) {
        expect(typeof w[key], `wall.${key}`).toBe('number');
      }
      expect(['N', 'S', 'E', 'W']).toContain(w.direction);
    }
  });

  it('walls have positive dimensions and constant thickness', () => {
    for (const seed of SEEDS) {
      for (const w of [...runStages(seed).walls.walls, ...runStages(seed).walls.internalWalls]) {
        expect(w.w).toBeGreaterThan(0);
        expect(w.h).toBeGreaterThan(0);
        expect(w.d).toBeGreaterThan(0);
        expect(Math.min(w.w, w.d)).toBeCloseTo(WALL.wallThickness);
      }
    }
  });

  it('N/S walls run along X and E/W walls run along Z', () => {
    for (const w of runStages(42).walls.walls) {
      if (w.direction === 'N' || w.direction === 'S') expect(w.d).toBeCloseTo(WALL.wallThickness);
      else expect(w.w).toBeCloseTo(WALL.wallThickness);
    }
  });

  it('wall rects stack within the tier band above their floor', () => {
    const { walls, config } = runStages(42);
    const stride = levelHeight(config);
    for (const w of walls.walls) {
      expect(w.h).toBeGreaterThan(0);
      expect(w.h).toBeLessThanOrEqual(wallGeomHeight(config) + EPS);
      // Each wall row lies within the room band above its floor surface.
      const offset = w.y - (w.floorY + config.slabThickness);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(wallGeomHeight(config));
      expect((w.floorY + config.slabThickness) % stride).toBe(0);
    }
  });

  it('wall tops meet the underside of the slab above: no gap and no overlap', () => {
    for (const seed of SEEDS) {
      const { walls, config } = runStages(seed);
      const nextSlabBottom = (w) => w.floorY + levelHeight(config) + config.slabThickness - floorThickness(config);
      const topByFloor = new Map();
      for (const w of walls.walls) {
        topByFloor.set(w.floorY, Math.max(topByFloor.get(w.floorY) ?? -Infinity, w.y + w.h));
      }
      // No wall row pokes through the slab above...
      for (const w of walls.walls) {
        expect(w.y + w.h, `seed ${seed} wall at ${w.x},${w.z}`).toBeLessThanOrEqual(nextSlabBottom(w) + EPS);
      }
      // ...and the highest row on each floor reaches it exactly (no gap).
      for (const [floorY, top] of topByFloor) {
        const probe = walls.walls.find(w => w.floorY === floorY);
        expect(top, `seed ${seed} floorY ${floorY}`).toBeCloseTo(nextSlabBottom(probe));
      }
    }
  });

  it('walls sit on a building edge (within the building footprint plus wall thickness)', () => {
    for (const seed of SEEDS) {
      const { walls, buildings } = runStages(seed);
      for (const w of walls.walls) {
        const hit = buildings.buildings.some(b =>
          w.x >= b.x - WALL.wallThickness - EPS && w.z >= b.z - WALL.wallThickness - EPS &&
          w.x + w.w <= b.x + b.w + WALL.wallThickness + EPS && w.z + w.d <= b.z + b.d + WALL.wallThickness + EPS);
        expect(hit, `seed ${seed} wall at ${w.x},${w.z}`).toBe(true);
      }
    }
  });

  it('internal walls lie inside a building footprint', () => {
    for (const seed of SEEDS) {
      const { walls, buildings } = runStages(seed);
      for (const w of walls.internalWalls) {
        const hit = buildings.buildings.some(b =>
          w.x >= b.x - EPS && w.z >= b.z - EPS && w.x + w.w <= b.x + b.w + EPS && w.z + w.d <= b.z + b.d + EPS);
        expect(hit, `seed ${seed} internal wall at ${w.x},${w.z}`).toBe(true);
      }
    }
  });

  it('walls are not placed above a building\'s highest tier', () => {
    const { walls, buildings, config } = runStages(42);
    const stride = levelHeight(config);
    const top = Math.max(...buildings.buildings.map(b => b.maxTier)) * stride;
    for (const w of walls.walls) expect(w.y + w.h).toBeLessThanOrEqual(top);
  });

  it('is deterministic for the same seed (separate generation runs)', () => {
    const a = runStages(42);
    const b = runStages(42, { textureSet: 'base' });
    expect(a).not.toBe(b);
    expect(a.walls.walls).toEqual(b.walls.walls);
    expect(a.walls.internalWalls).toEqual(b.walls.internalWalls);
  });

  it('seed 42 produces 276 wall segments and 9 internal walls', () => {
    const { walls } = runStages(42);
    expect(walls.walls.length).toBe(276);
    expect(walls.internalWalls.length).toBe(9);
  });
});
