import { CELL, STAGE } from '../collision/matrix.js';
import { coverGridWithRects } from '../../core/grid-rect-cover/index.js';

export function writePavements(blocks, matrix, config) {
  const { slabThickness } = config;
  const { ox, oz, cellSize: cs } = matrix;
  const pavementCy = Math.floor(-slabThickness / cs);
  const cells = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const cxStart = Math.round((block.x - ox) / cs);
    const czStart = Math.round((block.z - oz) / cs);
    const nCx     = Math.round(block.w / cs);
    const nCz     = Math.round(block.d / cs);

    matrix.setWriteContext(STAGE.PAVEMENTS, bi);
    for (let dcx = 0; dcx < nCx; dcx++) {
      for (let dcz = 0; dcz < nCz; dcz++) {
        const cx = cxStart + dcx;
        const cz = czStart + dcz;
        if (matrix.getCell(cx, 0, cz) !== CELL.SHELL) {
          matrix.setCell(cx, pavementCy, cz, CELL.PAVEMENT);
          cells.push({ cx, cz });
        }
      }
    }
  }

  return { cellCount: cells.length, rects: cellsToRects(cells, ox, oz, cs) };
}

// Greedy rect cover of the pavement cells (shared helper). Spans are in cell indices of the
// cells' bounding box; each is mapped back to world inches.
function cellsToRects(cells, ox, oz, cs) {
  if (!cells.length) return [];

  let minCx = Infinity, maxCx = -Infinity, minCz = Infinity, maxCz = -Infinity;
  const keys = new Set();
  for (const { cx, cz } of cells) {
    minCx = Math.min(minCx, cx); maxCx = Math.max(maxCx, cx);
    minCz = Math.min(minCz, cz); maxCz = Math.max(maxCz, cz);
    keys.add(`${cx},${cz}`);
  }

  return coverGridWithRects(
    maxCx - minCx + 1, maxCz - minCz + 1,
    (c, r) => keys.has(`${minCx + c},${minCz + r}`),
  ).map((span) => ({
    x: ox + (minCx + span.col) * cs, z: oz + (minCz + span.row) * cs,
    w: span.cols * cs, d: span.rows * cs,
  }));
}
