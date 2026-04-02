/**
 * Get a quadrant rectangle from building bounds.
 * Quadrants: 0=NW, 1=NE, 2=SW, 3=SE.
 */
export function getQuadrantRect(building, quadrant) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;
  const hw = building.w / 2;
  const hd = building.d / 2;
  switch (quadrant) {
    case 0: return { x: building.x, z: building.z, w: hw, d: hd };
    case 1: return { x: mx, z: building.z, w: hw, d: hd };
    case 2: return { x: building.x, z: mz, w: hw, d: hd };
    case 3: return { x: mx, z: mz, w: hw, d: hd };
  }
}
