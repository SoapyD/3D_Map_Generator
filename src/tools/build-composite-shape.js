/**
 * Build composite shape descriptors (L, U, uNarrow, uSmall).
 * Returns an array of building descriptors with suppressEdges.
 */

import { BUILDING } from '../config.js';
import { createBuilding } from './create-building.js';

export function buildCompositeShape(args, rng) {
  const base = createBuilding(args.type, 'full', args.tiers, rng);
  const { x, z } = base;
  const segW = rng.float(BUILDING.footprints.small.min, BUILDING.footprints.small.max);
  const segD = rng.float(BUILDING.footprints.small.min, BUILDING.footprints.small.max);
  const bProps = { maxTier: base.maxTier, size: 'small', height: base.height, blockIndex: 0, shape: 'full', pyramidRoof: false };

  if (args.shape.startsWith('lShape')) {
    return buildLShape(args.shape, x, z, segW, segD, bProps);
  }
  if (args.shape.startsWith('uShape')) {
    return buildUShape(args.shape, x, z, segW, segD, bProps);
  }
  if (args.shape.startsWith('uNarrow')) {
    return buildNarrowUShape(args.shape, x, z, segW, segD, bProps);
  }
  if (args.shape.startsWith('uSmall')) {
    return buildSmallUShape(args.shape, x, z, rng, bProps);
  }
  return [];
}

function buildLShape(shape, x, z, segW, segD, bProps) {
  let strip, ext, stripSuppress, extSuppress;
  if (shape === 'lShapeSW') {
    strip = { x, z, w: segW, d: segD * 3 };
    ext   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'west' }];
  } else if (shape === 'lShapeSE') {
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext   = { x, z: z + segD * 2, w: segW, d: segD };
    stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'east' }];
  } else if (shape === 'lShapeNW') {
    strip = { x, z, w: segW, d: segD * 3 };
    ext   = { x: x + segW, z, w: segW, d: segD };
    stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'west' }];
  } else {
    strip = { x: x + segW, z, w: segW, d: segD * 3 };
    ext   = { x, z, w: segW, d: segD };
    stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
    extSuppress = [{ edge: 'east' }];
  }

  return [
    { x: strip.x, z: strip.z, w: strip.w, d: strip.d, ...bProps, suppressEdges: stripSuppress },
    { x: ext.x, z: ext.z, w: ext.w, d: ext.d, ...bProps, suppressEdges: extSuppress },
  ];
}

function buildUShape(shape, x, z, segW, segD, bProps) {
  let left, right, bar, leftSup, rightSup, barSup;
  if (shape === 'uShapeN') {
    left  = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
    leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup   = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeS') {
    left  = { x, z, w: segW, d: segD * 3 };
    right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
    bar   = { x: x + segW, z, w: segW, d: segD };
    leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
    rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
    barSup   = [{ edge: 'west' }, { edge: 'east' }];
  } else if (shape === 'uShapeE') {
    left  = { x, z, w: segW * 3, d: segD };
    right = { x, z: z + segD * 2, w: segW * 3, d: segD };
    bar   = { x, z: z + segD, w: segW, d: segD };
    leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup   = [{ edge: 'north' }, { edge: 'south' }];
  } else {
    left  = { x, z, w: segW * 3, d: segD };
    right = { x, z: z + segD * 2, w: segW * 3, d: segD };
    bar   = { x: x + segW * 2, z: z + segD, w: segW, d: segD };
    leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
    rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
    barSup   = [{ edge: 'north' }, { edge: 'south' }];
  }

  return [
    { x: left.x, z: left.z, w: left.w, d: left.d, ...bProps, suppressEdges: leftSup },
    { x: right.x, z: right.z, w: right.w, d: right.d, ...bProps, suppressEdges: rightSup },
    { x: bar.x, z: bar.z, w: bar.w, d: bar.d, ...bProps, suppressEdges: barSup },
  ];
}

function buildNarrowUShape(shape, x, z, segW, segD, bProps) {
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
    { x: col.x, z: col.z, w: col.w, d: col.d, ...bProps, suppressEdges: colSup },
    { x: top.x, z: top.z, w: top.w, d: top.d, ...bProps, suppressEdges: topSup },
    { x: bot.x, z: bot.z, w: bot.w, d: bot.d, ...bProps, suppressEdges: botSup },
  ];
}

function buildSmallUShape(shape, x, z, rng, bProps) {
  const tFp = BUILDING.tower || { min: 2, max: 3 };
  const segW = rng.float(tFp.min, tFp.max);
  const segD = rng.float(tFp.min, tFp.max);

  let gapR, gapC;
  if (shape === 'uSmallN') { gapR = 1; gapC = 1; }
  else if (shape === 'uSmallS') { gapR = 1; gapC = 0; }
  else if (shape === 'uSmallE') { gapR = 2; gapC = 1; }
  else { gapR = 0; gapC = 1; }

  const isRotated = shape === 'uSmallE' || shape === 'uSmallW';
  const cols = isRotated ? 3 : 2;
  const rows = isRotated ? 2 : 3;
  const result = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === gapR && c === gapC) continue;
      const cx = x + c * segW;
      const cz = z + r * segD;
      const sup = [];
      if (r > 0 && !(r - 1 === gapR && c === gapC)) sup.push({ edge: 'north' });
      if (r < rows - 1 && !(r + 1 === gapR && c === gapC)) sup.push({ edge: 'south' });
      if (c > 0 && !(r === gapR && c - 1 === gapC)) sup.push({ edge: 'west' });
      if (c < cols - 1 && !(r === gapR && c + 1 === gapC)) sup.push({ edge: 'east' });
      result.push({ x: cx, z: cz, w: segW, d: segD, ...bProps, suppressEdges: sup });
    }
  }
  return result;
}
