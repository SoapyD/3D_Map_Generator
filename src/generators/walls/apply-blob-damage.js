import { WALL } from '../../config.js';

/**
 * Applies cascade damage to a wall cell grid.
 *
 * Row 2 (top)  — removed freely, spreading horizontally, up to row2Ratio of cols.
 * Row 1 (mid)  — only removable beneath an already-removed row 2 cell (or adjacent
 *                to another removed row 1 cell), up to row1Ratio of cols.
 * Row 0 (base) — same cascade rule from row 1, up to row0Ratio of cols.
 *
 * @param {'external'|'internal'} type
 */
export function applyBlobDamage(grid, rng, type = 'external') {
  const prefix = type === 'internal' ? 'internal' : 'external';
  const row2Ratio = WALL[`${prefix}Row2RemovalRatio`];
  const row1Ratio = WALL[`${prefix}Row1RemovalRatio`];
  const row0Ratio = WALL[`${prefix}Row0RemovalRatio`];

  const cols = grid.cols;

  // Convenience: get cell by col/row
  const cell = (col, row) => grid.cells.find(c => c.col === col && c.row === row);

  // --- Row 2: free horizontal spread from a random seed ---
  const maxRow2 = Math.floor(cols * row2Ratio);
  const removeRow2 = maxRow2 > 0 ? rng.int(0, maxRow2) : 0;
  const removedRow2 = [];

  for (let r = 0; r < removeRow2; r++) {
    if (r === 0) {
      const col = rng.int(0, cols - 1);
      const c = cell(col, 2);
      if (!c || !c.alive) break;
      c.alive = false;
      removedRow2.push(col);
    } else {
      const candidates = [];
      for (const col of removedRow2) {
        if (col > 0)        { const c = cell(col - 1, 2); if (c?.alive) candidates.push(col - 1); }
        if (col < cols - 1) { const c = cell(col + 1, 2); if (c?.alive) candidates.push(col + 1); }
      }
      if (candidates.length === 0) break;
      const col = rng.pick(candidates);
      cell(col, 2).alive = false;
      removedRow2.push(col);
    }
  }

  // --- Row 1: cascade from row 2, spreading horizontally ---
  const maxRow1 = Math.floor(cols * row1Ratio);
  const removeRow1 = maxRow1 > 0 ? rng.int(0, maxRow1) : 0;
  const removedRow1 = [];

  for (let r = 0; r < removeRow1; r++) {
    const candidates = new Set();
    // Seed: directly below a removed row 2 cell
    for (const col of removedRow2) {
      const c = cell(col, 1);
      if (c?.alive) candidates.add(col);
    }
    // Spread: adjacent to already-removed row 1 cells
    for (const col of removedRow1) {
      if (col > 0)        { const c = cell(col - 1, 1); if (c?.alive) candidates.add(col - 1); }
      if (col < cols - 1) { const c = cell(col + 1, 1); if (c?.alive) candidates.add(col + 1); }
    }
    if (candidates.size === 0) break;
    const col = rng.pick([...candidates]);
    cell(col, 1).alive = false;
    removedRow1.push(col);
  }

  // --- Row 0: cascade from row 1, same rules ---
  const maxRow0 = Math.floor(cols * row0Ratio);
  const removeRow0 = maxRow0 > 0 ? rng.int(0, maxRow0) : 0;
  const removedRow0 = [];

  for (let r = 0; r < removeRow0; r++) {
    const candidates = new Set();
    for (const col of removedRow1) {
      const c = cell(col, 0);
      if (c?.alive) candidates.add(col);
    }
    for (const col of removedRow0) {
      if (col > 0)        { const c = cell(col - 1, 0); if (c?.alive) candidates.add(col - 1); }
      if (col < cols - 1) { const c = cell(col + 1, 0); if (c?.alive) candidates.add(col + 1); }
    }
    if (candidates.size === 0) break;
    const col = rng.pick([...candidates]);
    cell(col, 0).alive = false;
    removedRow0.push(col);
  }
}
