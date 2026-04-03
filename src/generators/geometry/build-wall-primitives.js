import { findBuildingForWall } from '../building-lookup/index.js';
import { wallTextureKey } from '../wall-texture-key.js';

export function buildWallPrimitives(walls, buildings) {
  const primitives = [];

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const bi = findBuildingForWall(wall, buildings);
    const texKey = wallTextureKey(bi, buildings);
    const wx = wall.axis === 'x' ? wall.length : wall.thickness;
    const wz = wall.axis === 'z' ? wall.length : wall.thickness;

    primitives.push({
      type: 'wall', name: `wall_${i}`,
      x: wall.x, y: wall.baseY, z: wall.z, w: wx, h: wall.height, d: wz,
      textureKey: texKey,
      axis: wall.axis,
    });
  }

  return primitives;
}
