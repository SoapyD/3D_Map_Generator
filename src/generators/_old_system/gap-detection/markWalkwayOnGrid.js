// Mark a walkway's cells on the grid
export function markWalkwayOnGrid(w, state) {
  const { tierHeight, cellSize, gridD, gridW, grid } = state;
  const wTier = Math.round(w.y / tierHeight);
  const c0 = Math.floor(w.x / cellSize);
  const c1 = Math.floor((w.x + w.w - 0.01) / cellSize);
  const r0 = Math.floor(w.z / cellSize);
  const r1 = Math.floor((w.z + w.d - 0.01) / cellSize);
  for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
      grid[r][c].walkways.push({ axis: w.axis, tier: wTier });
    }
  }
}
