/**
 * Mark existing walkways and bridges on the grid with their axis and tier.
 */
export function markExistingConnections(grid, existingWalkways, existingBridges, tierHeight, cellSize, gridD, gridW) {
  for (const ew of [...existingWalkways, ...existingBridges]) {
    const ewTier = Math.round(ew.y / tierHeight);
    const c0 = Math.floor(ew.x / cellSize);
    const c1 = Math.floor((ew.x + ew.w - 0.01) / cellSize);
    const r0 = Math.floor(ew.z / cellSize);
    const r1 = Math.floor((ew.z + ew.d - 0.01) / cellSize);
    for (let r = Math.max(0, r0); r <= Math.min(gridD - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(gridW - 1, c1); c++) {
        grid[r][c].walkways.push({ axis: ew.axis, tier: ewTier });
      }
    }
  }
}
