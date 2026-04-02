// Check if a proposed walkway crosses a cell with an existing walkway at the same tier
// Blocks ANY axis crossing at the same tier (prevents criss-crossing)
export function crossesWalkway(wx, wz, ww, wd, wAxis, wTier, state) {
  const { cellSize, gridD, gridW, grid } = state;
  const c0 = Math.floor(wx / cellSize);
  const c1 = Math.floor((wx + ww - 0.01) / cellSize);
  const r0 = Math.floor(wz / cellSize);
  const r1 = Math.floor((wz + wd - 0.01) / cellSize);
  for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
      for (const ew of grid[r][c].walkways) {
        if (ew.tier === wTier) return true;
      }
    }
  }
  return false;
}
