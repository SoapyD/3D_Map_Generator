import { GLOBAL_GRID } from '../../config.js';

const BBD = GLOBAL_GRID.bbd;

export function createFoundationGrid(block) {
  const bbdW = Math.floor(block.w / BBD);
  const bbdD = Math.floor(block.d / BBD);
  const cells = Array.from({ length: bbdD }, () => new Array(bbdW).fill(false));
  return { block, cells, bbdW, bbdD };
}

export function markCells(grid, col, row, bbdW, bbdD) {
  for (let r = row; r < row + bbdD; r++)
    for (let c = col; c < col + bbdW; c++)
      grid.cells[r][c] = true;
}

export function findFreeCell(grid, bbdW, bbdD) {
  for (let r = 0; r <= grid.bbdD - bbdD; r++) {
    for (let c = 0; c <= grid.bbdW - bbdW; c++) {
      let free = true;
      outer:
      for (let dr = 0; dr < bbdD; dr++)
        for (let dc = 0; dc < bbdW; dc++)
          if (grid.cells[r + dr][c + dc]) { free = false; break outer; }
      if (free) return { col: c, row: r };
    }
  }
  return null;
}
