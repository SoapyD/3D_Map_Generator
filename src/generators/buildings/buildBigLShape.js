export function buildBigLShape(shape, x, z, segW, segD, maxTier, sizeKey) {
  let strip, ext, stripSup, extSup;
  if (shape === 'lShapeSW') {
    strip = { x, z, w: segW, d: segD * 3 };
    ext = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    stripSup = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSup = [{ edge: 'west' }];
  } else if (shape === 'lShapeSE') {
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext = { x, z: z + segD * 2, w: segW, d: segD };
    stripSup = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSup = [{ edge: 'east' }];
  } else if (shape === 'lShapeNW') {
    strip = { x, z, w: segW, d: segD * 3 };
    ext = { x: x + segW, z, w: segW, d: segD };
    stripSup = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSup = [{ edge: 'west' }];
  } else {
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext = { x, z, w: segW, d: segD };
    stripSup = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSup = [{ edge: 'east' }];
  }
  return [
    { x: strip.x, z: strip.z, w: strip.w, d: strip.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: stripSup },
    { x: ext.x, z: ext.z, w: ext.w, d: ext.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: extSup },
  ];
}
