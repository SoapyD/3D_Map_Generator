/**
 * Get the rectangle for a specific quadrant of a building.
 */
export function getQuadrantRect(building, q) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;
  switch (q) {
    case 0: return { x: building.x, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 1: return { x: mx, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 2: return { x: building.x, z: mz, w: building.w / 2, d: building.d / 2 };
    case 3: return { x: mx, z: mz, w: building.w / 2, d: building.d / 2 };
  }
}
