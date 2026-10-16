import { describe, it, expect } from 'vitest';
import { coverGridWithRects } from '../../src/core/grid-rect-cover/index.js';
import { subdivideWall } from '../../src/generators/walls/subdivide-wall.js';
import { mergeWallCells } from '../../src/generators/walls/merge-wall-cells.js';
import { quadrantsToSections } from '../../src/generators/floors/quadrants-to-sections.js';

/** Build alive(c, r) from rows of '#'/'.' strings. */
function fromRows(rows) {
  return { cols: rows[0].length, rows: rows.length, alive: (c, r) => rows[r][c] === '#' };
}

/** Cells covered by the spans, counting repeats (a repeat means overlap). */
function coverage(spans, cols, rows) {
  const count = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (const s of spans) {
    for (let r = s.row; r < s.row + s.rows; r++) for (let c = s.col; c < s.col + s.cols; c++) count[r][c]++;
  }
  return count;
}

describe('coverGridWithRects', () => {
  it('covers a full grid with one rect', () => {
    const g = fromRows(['####', '####', '####']);
    expect(coverGridWithRects(g.cols, g.rows, g.alive)).toEqual([{ col: 0, row: 0, cols: 4, rows: 3 }]);
  });

  it('returns nothing for an empty grid', () => {
    expect(coverGridWithRects(3, 3, () => false)).toEqual([]);
  });

  it('partitions the alive cells exactly: no overlap, union equals alive cells (holes included)', () => {
    const g = fromRows([
      '#####.##',
      '##.##.##',
      '##...###',
      '#.#####.',
    ]);
    const counts = coverage(coverGridWithRects(g.cols, g.rows, g.alive), g.cols, g.rows);
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) expect(counts[r][c], `cell ${c},${r}`).toBe(g.alive(c, r) ? 1 : 0);
    }
  });

  it('is deterministic', () => {
    const g = fromRows(['##.#', '#.##', '####']);
    expect(coverGridWithRects(g.cols, g.rows, g.alive)).toEqual(coverGridWithRects(g.cols, g.rows, g.alive));
  });

  it('extends right first, then stacks rows only when the whole run is alive below (greedy)', () => {
    const g = fromRows(['###', '##.']);
    expect(coverGridWithRects(g.cols, g.rows, g.alive)).toEqual([
      { col: 0, row: 0, cols: 3, rows: 1 },
      { col: 0, row: 1, cols: 2, rows: 1 },
    ]);
  });
});

describe('mergeWallCells (via the shared cover)', () => {
  const wall = { direction: 'N', floorY: 0, x: 10, y: 1, z: 5, w: 4, h: 2.75, d: 0.5 };

  it('keeps the short 0.75 top row height and covers an undamaged wall with one rect', () => {
    const rects = mergeWallCells(subdivideWall(wall), wall);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ x: 10, y: 1, z: 5, w: 4, d: 0.5 });
    expect(rects[0].h).toBeCloseTo(2.75, 9);
  });

  it('keeps total area and leaves a hole for a killed cell', () => {
    const grid = subdivideWall(wall);
    grid.cells.find((c) => c.col === 1 && c.row === 1).alive = false; // 1 x 1 cell
    const rects = mergeWallCells(grid, wall);
    const area = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(area).toBeCloseTo(4 * 2.75 - 1, 9);
    for (const a of rects) {
      for (const b of rects) {
        if (a === b) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 1e-9 && oy > 1e-9).toBe(false);
      }
    }
  });

  it('runs E/W walls along Z', () => {
    const ew = { direction: 'E', floorY: 0, x: 3, y: 0, z: 2, w: 0.5, h: 2, d: 3 };
    const rects = mergeWallCells(subdivideWall(ew), ew);
    expect(rects).toEqual([{ direction: 'E', floorY: 0, x: 3, y: 0, z: 2, w: 0.5, h: 2, d: 3 }]);
  });
});

describe('quadrantsToSections (via the shared cover)', () => {
  const b = { x: 0, z: 0, w: 8, d: 6 };

  it('returns one rect for a full plate', () => {
    expect(quadrantsToSections(b, new Set([0, 1, 2, 3]))).toEqual([{ x: 0, z: 0, w: 8, d: 6 }]);
  });

  it('keeps the covered footprint for partial plates', () => {
    const area = (rs) => rs.reduce((s, r) => s + r.w * r.d, 0);
    expect(area(quadrantsToSections(b, new Set([0, 2, 3])))).toBe(36);
    expect(area(quadrantsToSections(b, new Set([1])))).toBe(12);
    expect(quadrantsToSections(b, new Set())).toEqual([]);
  });
});
