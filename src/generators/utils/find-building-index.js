/**
 * Find which building a section belongs to.
 */
export function findBuildingIndex(section, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (section.x >= b.x - 0.1 && section.z >= b.z - 0.1 &&
        section.x + section.w <= b.x + b.w + 0.1 &&
        section.z + section.d <= b.z + b.d + 0.1) {
      return i;
    }
  }
  return -1;
}
