export function buildBigUShape(shape, x, z, segW, segD, maxTier, sizeKey) {
  let left, right, bar, leftSup, rightSup, barSup;
  if (shape === 'uShapeN') {
    left = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    leftSup = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeS') {
    left = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar = { x: x + segW, z, w: segW, d: segD };
    leftSup = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeE') {
    left = { x, z, w: segW * 3, d: segD };
    right = { x, z: z + segD * 2, w: segW * 3, d: segD };
    bar = { x, z: z + segD, w: segW, d: segD };
    leftSup = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup = [{ edge: 'north' }, { edge: 'south' }];
  } else {
    left = { x, z, w: segW * 3, d: segD };
    right = { x, z: z + segD * 2, w: segW * 3, d: segD };
    bar = { x: x + segW * 2, z: z + segD, w: segW, d: segD };
    leftSup = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup = [{ edge: 'north' }, { edge: 'south' }];
  }
  return [
    { x: left.x, z: left.z, w: left.w, d: left.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: leftSup },
    { x: right.x, z: right.z, w: right.w, d: right.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: rightSup },
    { x: bar.x, z: bar.z, w: bar.w, d: bar.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: barSup },
  ];
}
