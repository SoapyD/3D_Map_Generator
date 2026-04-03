/**
 * Find which building a wall belongs to (looser tolerance).
 */
export function findBuildingForWall(wall, buildings) {
  const wx = wall.axis === 'x' ? wall.x + wall.length / 2 : wall.x;
  const wz = wall.axis === 'z' ? wall.z + wall.length / 2 : wall.z;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x - 1 && wx <= b.x + b.w + 1 && wz >= b.z - 1 && wz <= b.z + b.d + 1) {
      return i;
    }
  }
  return -1;
}
