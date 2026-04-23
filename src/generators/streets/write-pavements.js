import { CELL, STAGE } from '../collision/matrix.js';

export function writePavements(blocks, matrix, config) {
  const { slabThickness } = config;
  const { ox, oz, cellSize: cs } = matrix;
  const pavementCy = Math.floor(-slabThickness / cs);
  let cellCount = 0;

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
          cellCount++;
        }
      }
    }
  }

  return cellCount;
}
