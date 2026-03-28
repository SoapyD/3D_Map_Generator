import { describe, it, expect } from 'vitest';
import { rectsOverlap, getWallBounds, rectCollidesWithWall, getQuadrantRect } from '../../src/core/spatial.js';

describe('rectsOverlap', () => {
  it('returns true for overlapping rects', () => {
    const a = { x: 0, z: 0, w: 5, d: 5 };
    const b = { x: 3, z: 3, w: 5, d: 5 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for non-overlapping rects', () => {
    const a = { x: 0, z: 0, w: 5, d: 5 };
    const b = { x: 10, z: 10, w: 5, d: 5 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for rects that touch but do not overlap', () => {
    const a = { x: 0, z: 0, w: 5, d: 5 };
    const b = { x: 5, z: 0, w: 5, d: 5 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns true for fully contained rect', () => {
    const a = { x: 0, z: 0, w: 10, d: 10 };
    const b = { x: 2, z: 2, w: 3, d: 3 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('handles partial overlap on X axis only', () => {
    const a = { x: 0, z: 0, w: 5, d: 5 };
    const b = { x: 3, z: 6, w: 5, d: 5 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('handles partial overlap on Z axis only', () => {
    const a = { x: 0, z: 0, w: 5, d: 5 };
    const b = { x: 6, z: 3, w: 5, d: 5 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

describe('getWallBounds', () => {
  it('computes bounds for an x-axis wall', () => {
    const wall = { x: 2, z: 3, axis: 'x', length: 10, thickness: 0.25 };
    const bounds = getWallBounds(wall);
    expect(bounds.x).toBe(2);
    expect(bounds.z).toBe(3);
    expect(bounds.w).toBe(10);
    expect(bounds.d).toBe(0.25);
    expect(bounds.x1).toBe(12);
    expect(bounds.z1).toBeCloseTo(3.25);
  });

  it('computes bounds for a z-axis wall', () => {
    const wall = { x: 5, z: 1, axis: 'z', length: 8, thickness: 0.25 };
    const bounds = getWallBounds(wall);
    expect(bounds.x).toBe(5);
    expect(bounds.z).toBe(1);
    expect(bounds.w).toBe(0.25);
    expect(bounds.d).toBe(8);
    expect(bounds.x1).toBeCloseTo(5.25);
    expect(bounds.z1).toBe(9);
  });
});

describe('rectCollidesWithWall', () => {
  it('detects collision between rect and wall', () => {
    const rect = { x: 1, z: 2, w: 5, d: 5 };
    const wall = { x: 3, z: 4, axis: 'x', length: 6, thickness: 0.25 };
    expect(rectCollidesWithWall(rect, wall)).toBe(true);
  });

  it('returns false when no collision', () => {
    const rect = { x: 0, z: 0, w: 2, d: 2 };
    const wall = { x: 10, z: 10, axis: 'x', length: 5, thickness: 0.25 };
    expect(rectCollidesWithWall(rect, wall)).toBe(false);
  });

  it('respects margin parameter', () => {
    const rect = { x: 0, z: 0, w: 5, d: 5 };
    const wall = { x: 5.1, z: 0, axis: 'z', length: 5, thickness: 0.25 };
    // Without margin, no collision (rect ends at 5, wall starts at 5.1)
    expect(rectCollidesWithWall(rect, wall, 0)).toBe(false);
    // With margin of 0.5, should collide
    expect(rectCollidesWithWall(rect, wall, 0.5)).toBe(true);
  });
});

describe('getQuadrantRect', () => {
  const building = { x: 0, z: 0, w: 10, d: 8 };

  it('returns NW quadrant (0)', () => {
    const q = getQuadrantRect(building, 0);
    expect(q.x).toBe(0);
    expect(q.z).toBe(0);
    expect(q.w).toBe(5);
    expect(q.d).toBe(4);
  });

  it('returns NE quadrant (1)', () => {
    const q = getQuadrantRect(building, 1);
    expect(q.x).toBe(5);
    expect(q.z).toBe(0);
    expect(q.w).toBe(5);
    expect(q.d).toBe(4);
  });

  it('returns SW quadrant (2)', () => {
    const q = getQuadrantRect(building, 2);
    expect(q.x).toBe(0);
    expect(q.z).toBe(4);
    expect(q.w).toBe(5);
    expect(q.d).toBe(4);
  });

  it('returns SE quadrant (3)', () => {
    const q = getQuadrantRect(building, 3);
    expect(q.x).toBe(5);
    expect(q.z).toBe(4);
    expect(q.w).toBe(5);
    expect(q.d).toBe(4);
  });

  it('quadrants tile the full building', () => {
    const quads = [0, 1, 2, 3].map(q => getQuadrantRect(building, q));
    const totalArea = quads.reduce((sum, q) => sum + q.w * q.d, 0);
    expect(totalArea).toBeCloseTo(building.w * building.d);
  });

  it('quadrants do not overlap', () => {
    const quads = [0, 1, 2, 3].map(q => getQuadrantRect(building, q));
    for (let i = 0; i < quads.length; i++) {
      for (let j = i + 1; j < quads.length; j++) {
        expect(rectsOverlap(quads[i], quads[j])).toBe(false);
      }
    }
  });
});
