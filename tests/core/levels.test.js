import { describe, it, expect } from 'vitest';
import { DEFAULTS, FLOOR_SLAB, WALL } from '../../src/config.js';
import {
  slabCellHeight, floorThickness, levelHeight, floorCellY, floorSurfaceY, floorGeomY,
  floorIndexFromCy, tierIndexFromY, wallBaseY, nextFloorCellY, wallMatrixRows, wallGeomHeight,
  shellHeight, matrixHeight,
} from '../../src/core/levels.js';

const config = { ...DEFAULTS };
const TIERS = [0, 1, 2, 3, 4];

describe('levels — thin floor slab model', () => {
  it('a tier costs tierHeight of vertical space (no extra slab cell)', () => {
    expect(levelHeight(config)).toBe(config.tierHeight);
    expect(floorSurfaceY(1, config) - floorSurfaceY(0, config)).toBe(config.tierHeight);
  });

  it('the floor slab is as thin as a wall and flush with the top of its matrix cell', () => {
    expect(floorThickness(config)).toBe(FLOOR_SLAB.thickness);
    expect(floorThickness(config)).toBe(WALL.wallThickness);
    for (const i of TIERS) {
      expect(floorGeomY(i, config) + floorThickness(config)).toBeCloseTo(floorSurfaceY(i, config));
      expect(floorCellY(i, config) + slabCellHeight(config)).toBe(floorSurfaceY(i, config));
      expect(floorGeomY(i, config)).toBeGreaterThanOrEqual(floorCellY(i, config));
    }
  });

  it('ground slab (tier 0) tops out at Y=0 like streets', () => {
    expect(floorSurfaceY(0, config)).toBe(0);
    expect(floorCellY(0, config)).toBe(-slabCellHeight(config));
    expect(floorGeomY(0, config)).toBeCloseTo(-WALL.wallThickness);
  });

  it('floorIndexFromCy inverts floorCellY', () => {
    for (const i of TIERS) expect(floorIndexFromCy(floorCellY(i, config), config)).toBe(i);
  });

  it('surfaces and slab cells are strictly increasing', () => {
    for (const i of TIERS.slice(1)) {
      expect(floorSurfaceY(i, config)).toBeGreaterThan(floorSurfaceY(i - 1, config));
      expect(floorCellY(i, config)).toBeGreaterThan(floorCellY(i - 1, config));
    }
  });

  it('tierIndexFromY bands slab, walls and surface features to the right tier', () => {
    for (const i of TIERS) {
      expect(tierIndexFromY(floorGeomY(i, config), config)).toBe(i);
      expect(tierIndexFromY(floorSurfaceY(i, config), config)).toBe(i);
      // The highest wall row base of the tier (surface + wallMatrixRows) stays with the tier.
      expect(tierIndexFromY(floorSurfaceY(i, config) + wallMatrixRows(config), config)).toBe(i);
      // A 0.5" bridge deck flush with this tier's surface bands to it.
      expect(tierIndexFromY(floorSurfaceY(i, config) - FLOOR_SLAB.bandLookahead, config)).toBe(i);
    }
  });

  it('wall geometry top meets the underside of the slab above (no gap, no overlap)', () => {
    for (const i of TIERS) {
      const wallTop = wallBaseY(floorCellY(i, config), config) + wallGeomHeight(config);
      expect(wallTop).toBeCloseTo(floorGeomY(i + 1, config));
    }
  });

  it('wall matrix rows end exactly below the next tier\'s slab cell', () => {
    for (const i of TIERS) {
      const cy = floorCellY(i, config);
      expect(wallBaseY(cy, config) + wallMatrixRows(config)).toBe(nextFloorCellY(cy, config));
      expect(nextFloorCellY(cy, config)).toBe(floorCellY(i + 1, config));
    }
  });

  it('default room: 2 matrix rows, 2.75" of wall', () => {
    expect(wallMatrixRows(config)).toBe(2);
    expect(wallGeomHeight(config)).toBeCloseTo(2.75);
  });

  it('building shell runs from the ground slab cell to the roof slab cell inclusive', () => {
    for (const maxTier of [1, 2, 3, 4]) {
      const bottom = floorCellY(0, config);
      const top = bottom + shellHeight(maxTier, config) - 1; // highest filled cell
      expect(top).toBe(floorCellY(maxTier - 1, config));
    }
  });

  it('4 tiers (+ base) stack to 12" of surfaces; the matrix reserves one tier of headroom', () => {
    expect(floorSurfaceY(config.tiers, config)).toBe(12);
    expect(matrixHeight(config.tiers, config)).toBe((config.tiers + 1) * levelHeight(config));
  });
});
