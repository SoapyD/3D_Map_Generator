/**
 * Check if a wall's end-cap face is fully covered by an adjacent wall.
 *
 * A single-point edge check with a large margin incorrectly suppresses end caps
 * at trimmed corners — a trimmed N wall ends exactly where the E wall starts, so
 * the old code thought the E wall's north end cap was covered when it isn't.
 *
 * Fix: require the covering wall to span the FULL extent of the face being
 * checked, not just contain the edge point.
 */
export function wallEdgeCovered(wallPrim, side, allWallPrims) {
  const margin = 0.01;

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

    if (wallPrim.axis === 'x') {
      // End-cap face spans Z = [edgeZ, edgeZ + wallPrim.d] at X = edgeX.
      // The covering wall must contain edgeX AND span the full Z range of the face.
      if (edgeX >= other.x - margin && edgeX <= other.x + other.w + margin &&
          edgeZ >= other.z - margin && edgeZ + wallPrim.d <= other.z + other.d + margin) {
        return true;
      }
    } else {
      // End-cap face spans X = [edgeX, edgeX + wallPrim.w] at Z = edgeZ.
      // The covering wall must span the full X range of the face AND contain edgeZ.
      if (edgeX >= other.x - margin && edgeX + wallPrim.w <= other.x + other.w + margin &&
          edgeZ >= other.z - margin && edgeZ <= other.z + other.d + margin) {
        return true;
      }
    }
  }
  return false;
}
