/**
 * Populate grid cells from floor sections, tagging each cell with its building index.
 */
export function populateGridFromFloors(grid, tierFloors, buildings, cellSize, gridD, gridW) {
  for (const section of tierFloors.sections) {
    // Find which building this section belongs to
    let bi = -1;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (section.x >= b.x - 0.5 && section.x + section.w <= b.x + b.w + 0.5 &&
          section.z >= b.z - 0.5 && section.z + section.d <= b.z + b.d + 0.5) {
        bi = i;
        break;
      }
    }

    // Fill grid cells covered by this section
    const col0 = Math.floor(section.x / cellSize);
    const col1 = Math.floor((section.x + section.w - 0.01) / cellSize);
    const row0 = Math.floor(section.z / cellSize);
    const row1 = Math.floor((section.z + section.d - 0.01) / cellSize);
    for (let r = row0; r <= row1 && r < gridD; r++) {
      for (let c = col0; c <= col1 && c < gridW; c++) {
        if (r >= 0 && c >= 0) {
          grid[r][c].hasFloor = true;
          grid[r][c].buildingIndex = bi;
        }
      }
    }
  }
}
