/**
 * Find which building a wall belongs to (looser tolerance).
 */
export function findBuildingForWall(wall, buildings) {
  const wx = wall.x + wall.w / 2;
  const wz = wall.z + wall.d / 2;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x - 1 && wx <= b.x + b.w + 1 && wz >= b.z - 1 && wz <= b.z + b.d + 1) {
      return i;
    }
  }
  return -1;
}
