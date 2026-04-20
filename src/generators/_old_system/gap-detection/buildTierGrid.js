/**
 * Create an empty spatial grid for gap detection.
 * Each cell tracks: buildingIndex, hasFloor, and walkway overlaps.
 */
export function buildTierGrid(gridD, gridW) {
  return Array.from({ length: gridD }, () =>
    Array.from({ length: gridW }, () => ({ buildingIndex: -1, hasFloor: false, walkways: [] }))
  );
}
