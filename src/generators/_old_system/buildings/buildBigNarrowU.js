export function buildBigNarrowU(shape, x, z, segW, segD, maxTier, sizeKey) {
  let col, top, bot, colSup, topSup, botSup;
  if (shape === 'uNarrowN') {
    col = { x, z, w: segW, d: segD * 3 };
    top = { x: x + segW, z, w: segW, d: segD };
    bot = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    colSup = [{ edge: 'east', zMin: top.z, zMax: top.z + top.d }, { edge: 'east', zMin: bot.z, zMax: bot.z + bot.d }];
    topSup = [{ edge: 'west' }]; botSup = [{ edge: 'west' }];
  } else if (shape === 'uNarrowS') {
    col = { x: x + segW, z, w: segW, d: segD * 3 };
    top = { x, z, w: segW, d: segD };
    bot = { x, z: z + segD * 2, w: segW, d: segD };
    colSup = [{ edge: 'west', zMin: top.z, zMax: top.z + top.d }, { edge: 'west', zMin: bot.z, zMax: bot.z + bot.d }];
    topSup = [{ edge: 'east' }]; botSup = [{ edge: 'east' }];
  } else if (shape === 'uNarrowE') {
    col = { x, z, w: segW * 3, d: segD };
    top = { x, z: z + segD, w: segW, d: segD };
    bot = { x: x + segW * 2, z: z + segD, w: segW, d: segD };
    colSup = [{ edge: 'south', xMin: top.x, xMax: top.x + top.w }, { edge: 'south', xMin: bot.x, xMax: bot.x + bot.w }];
    topSup = [{ edge: 'north' }]; botSup = [{ edge: 'north' }];
  } else {
    col = { x, z: z + segD, w: segW * 3, d: segD };
    top = { x, z, w: segW, d: segD };
    bot = { x: x + segW * 2, z, w: segW, d: segD };
    colSup = [{ edge: 'north', xMin: top.x, xMax: top.x + top.w }, { edge: 'north', xMin: bot.x, xMax: bot.x + bot.w }];
    topSup = [{ edge: 'south' }]; botSup = [{ edge: 'south' }];
  }
  return [
    { x: col.x, z: col.z, w: col.w, d: col.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: colSup },
    { x: top.x, z: top.z, w: top.w, d: top.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: topSup },
    { x: bot.x, z: bot.z, w: bot.w, d: bot.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: botSup },
  ];
}
