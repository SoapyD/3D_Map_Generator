/**
 * Find which building a floor section belongs to.
 */
export function findBuilding(x, z, w, d, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x >= b.x - 0.5 && z >= b.z - 0.5 &&
        x + w <= b.x + b.w + 0.5 && z + d <= b.z + b.d + 0.5) {
      return i;
    }
  }
  return -1;
}
