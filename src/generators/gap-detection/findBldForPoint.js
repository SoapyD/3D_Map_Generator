// Find the building that contains (or nearly contains) the given point
export function findBldForPoint(x, z, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x >= b.x - 1.5 && x <= b.x + b.w + 1.5 && z >= b.z - 1.5 && z <= b.z + b.d + 1.5) return i;
  }
  return -1;
}
