import { findBuildingForWall } from '../building-lookup/index.js';
import { wallTextureKey } from '../wall-texture-key.js';

// N/S walls run along X → axis 'x'; E/W walls run along Z → axis 'z'
const DIR_AXIS = { N: 'x', S: 'x', E: 'z', W: 'z' };

export function buildWallPrimitives(walls, buildings) {
  const primitives = [];

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const bi = findBuildingForWall(wall, buildings);
    const texKey = wallTextureKey(bi, buildings);
    const axis = DIR_AXIS[wall.direction] ?? 'x';

    primitives.push({
      type: 'wall', name: `wall_${i}`,
      x: wall.x, y: wall.y, z: wall.z, w: wall.w, h: wall.h, d: wall.d,
      textureKey: texKey,
      axis,
    });
  }

  return primitives;
}
