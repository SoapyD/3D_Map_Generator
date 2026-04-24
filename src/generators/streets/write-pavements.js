import { CELL, STAGE } from '../collision/matrix.js';

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

// Group cells into row-run rects: for each Z row, merge contiguous X runs.
function cellsToRects(cells, ox, oz, cs) {
  if (!cells.length) return [];

  const byRow = new Map();
  for (const { cx, cz } of cells) {
    if (!byRow.has(cz)) byRow.set(cz, []);
    byRow.get(cz).push(cx);
  }

  const rects = [];
  for (const [cz, cxList] of byRow) {
    cxList.sort((a, b) => a - b);
    let start = cxList[0], end = cxList[0];
    for (let i = 1; i < cxList.length; i++) {
      if (cxList[i] === end + 1) {
        end = cxList[i];
      } else {
        rects.push({ x: ox + start * cs, z: oz + cz * cs, w: (end - start + 1) * cs, d: cs });
        start = end = cxList[i];
      }
    }
    rects.push({ x: ox + start * cs, z: oz + cz * cs, w: (end - start + 1) * cs, d: cs });
  }

  return rects;
}
