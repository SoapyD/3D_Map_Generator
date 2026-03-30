/**
 * Building Layout Placement
 *
 * Places larger buildings (medium/large) according to one of 5 layout options.
 * Extracted from buildings.js to keep file sizes manageable.
 */

import { BUILDING } from '../config.js';
import { pickShape } from './buildings.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Generate a single big building (possibly composite) at a given position.
 * Returns an array of building segments (1 for 'full', 2-3 for L/U shapes).
 */
export function generateBigBuilding(sizeKey, pos, config, maxTiers, rng) {
  const mw = config.mapWidth;
  const md = config.mapDepth;
  const margin = 2;

  const fp = FOOTPRINTS[sizeKey];
  const w = rng.float(fp.min, fp.max);
  const d = rng.float(fp.min, fp.max);
  const x = Math.max(margin, Math.min(pos.x - w / 2, mw - w - margin));
  const z = Math.max(margin, Math.min(pos.z - d / 2, md - d - margin));
  const maxTier = rng.int(3, Math.min(5, maxTiers));
  const shape = pickShape(rng, sizeKey);

  if (shape === 'full') {
    return [{ x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full' }];
  }

  const segW = rng.float(fp.min / 2, fp.max / 2);
  const segD = rng.float(fp.min / 2, fp.max / 2);
  const results = [];

  if (shape.startsWith('lShape')) {
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
    results.push({ x: strip.x, z: strip.z, w: strip.w, d: strip.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: stripSup });
    results.push({ x: ext.x, z: ext.z, w: ext.w, d: ext.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: extSup });
  } else if (shape.startsWith('uNarrow')) {
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
    results.push({ x: col.x, z: col.z, w: col.w, d: col.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: colSup });
    results.push({ x: top.x, z: top.z, w: top.w, d: top.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: topSup });
    results.push({ x: bot.x, z: bot.z, w: bot.w, d: bot.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: botSup });
  } else if (shape.startsWith('uShape')) {
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
    results.push({ x: left.x, z: left.z, w: left.w, d: left.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: leftSup });
    results.push({ x: right.x, z: right.z, w: right.w, d: right.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: rightSup });
    results.push({ x: bar.x, z: bar.z, w: bar.w, d: bar.d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full', suppressEdges: barSup });
  } else {
    return [{ x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full' }];
  }

  const groupMarker = Symbol('group');
  for (const r of results) r._groupMarker = groupMarker;
  return results;
}

/**
 * Return the list of placement specs for a given layout.
 * Each spec is { sizeKey, pos } — the caller generates and validates each one.
 */
export function getLayoutSpecs(layout, config) {
  const mw = config.mapWidth;
  const md = config.mapDepth;

  const TL = { x: mw * 0.25, z: md * 0.25 };
  const TR = { x: mw * 0.75, z: md * 0.25 };
  const BL = { x: mw * 0.25, z: md * 0.75 };
  const BR = { x: mw * 0.75, z: md * 0.75 };
  const C  = { x: mw * 0.5, z: md * 0.5 };

  switch (layout) {
    case 0: return [{ sizeKey: 'large', pos: C }];
    case 1: return [{ sizeKey: 'large', pos: TL }, { sizeKey: 'large', pos: BR }];
    case 2: return [{ sizeKey: 'medium', pos: TL }, { sizeKey: 'medium', pos: BR }, { sizeKey: 'medium', pos: TR }];
    case 3: return [{ sizeKey: 'medium', pos: TL }, { sizeKey: 'medium', pos: BL }, { sizeKey: 'medium', pos: TR }];
    case 4: {
      const TL1 = { x: mw * 0.15, z: md * 0.15 };
      const TL2 = { x: mw * 0.35, z: md * 0.35 };
      return [{ sizeKey: 'medium', pos: TL1 }, { sizeKey: 'medium', pos: TL2 }, { sizeKey: 'medium', pos: BR }, { sizeKey: 'medium', pos: TR }];
    }
    default: return [];
  }
}
