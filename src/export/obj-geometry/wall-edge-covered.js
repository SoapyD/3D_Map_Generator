/**
 * Check if a wall's edge is covered by an adjacent wall.
 */
export function wallEdgeCovered(wallPrim, side, allWallPrims) {
  const margin = 0.5;
  let edgeX, edgeZ;
  if (wallPrim.axis === 'x') {
    edgeX = side === 'start' ? wallPrim.x : wallPrim.x + wallPrim.w;
    edgeZ = wallPrim.z;
  } else {
    edgeX = wallPrim.x;
    edgeZ = side === 'start' ? wallPrim.z : wallPrim.z + wallPrim.d;
  }

  for (const other of allWallPrims) {
    if (other === wallPrim) continue;
    if (Math.abs(wallPrim.y - other.y) > 0.5) continue;
    if (edgeX >= other.x - margin && edgeX <= other.x + other.w + margin &&
        edgeZ >= other.z - margin && edgeZ <= other.z + other.d + margin) {
      return true;
    }
  }
  return false;
}
