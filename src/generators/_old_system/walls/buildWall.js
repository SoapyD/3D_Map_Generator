/**
 * Get the position, length, height and baseY for a wall on a given edge.
 */
export function buildWall(building, edgeLabel, present, baseY, wallHeight, thickness) {
  const { x, z, w, d } = building;
  const mx = x + w / 2;
  const mz = z + d / 2;

  switch (edgeLabel) {
    case 'north': {
      const has0 = present.has(0);
      const has1 = present.has(1);
      if (!has0 && !has1) return null;
      return { x: has0 ? x : mx, z: z, length: (has0 && has1) ? w : w / 2, height: wallHeight, baseY, thickness, axis: 'x' };
    }
    case 'south': {
      const has2 = present.has(2);
      const has3 = present.has(3);
      if (!has2 && !has3) return null;
      return { x: has2 ? x : mx, z: z + d - thickness, length: (has2 && has3) ? w : w / 2, height: wallHeight, baseY, thickness, axis: 'x' };
    }
    case 'west': {
      const has0 = present.has(0);
      const has2 = present.has(2);
      if (!has0 && !has2) return null;
      return { x: x, z: has0 ? z : mz, length: (has0 && has2) ? d : d / 2, height: wallHeight, baseY, thickness, axis: 'z' };
    }
    case 'east': {
      const has1 = present.has(1);
      const has3 = present.has(3);
      if (!has1 && !has3) return null;
      return { x: x + w - thickness, z: has1 ? z : mz, length: (has1 && has3) ? d : d / 2, height: wallHeight, baseY, thickness, axis: 'z' };
    }
  }
  return null;
}
