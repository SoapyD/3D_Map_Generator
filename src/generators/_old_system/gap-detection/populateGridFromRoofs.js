/**
 * Populate grid cells from roof sections at a given tier (roofs are walkable surfaces).
 */
export function populateGridFromRoofs(grid, data, tier, cellSize, gridD, gridW) {
  if (!data.roofs) return;

  for (const r of data.roofs) {
    if (r.tier !== tier) continue;
    const section = r.section || r.building;
    if (!section) continue;

    let bi = r.buildingIndex;
    if (bi === undefined || bi < 0) bi = -1;

    const col0 = Math.floor(section.x / cellSize);
    const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
    const row0 = Math.floor(section.z / cellSize);
    const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
    for (let row = row0; row <= row1 && row < gridD; row++) {
      for (let c = col0; c <= col1 && c < gridW; c++) {
        if (row >= 0 && c >= 0) {
          grid[row][c].hasFloor = true;
          if (bi >= 0) grid[row][c].buildingIndex = bi;
        }
      }
    }
  }
}
