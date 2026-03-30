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
 * Place larger buildings according to one of 5 layout options.
 *
 * 0: 1 large in centre
 * 1: 2 large — top-left + bottom-right
 * 2: 3 medium — top-left + bottom-right + top-right
 * 3: 3 medium — top-left + bottom-left + top-right
 * 4: 4 medium — 2 in top-left + bottom-right + top-right
 */
export function placeBigLayout(layout, config, maxTiers, rng) {
  const mw = config.mapWidth;
  const md = config.mapDepth;
  const margin = 2; // keep away from map edge

  // Quadrant centres
  const TL = { x: mw * 0.25, z: md * 0.25 };
  const TR = { x: mw * 0.75, z: md * 0.25 };
  const BL = { x: mw * 0.25, z: md * 0.75 };
  const BR = { x: mw * 0.75, z: md * 0.75 };
  const C  = { x: mw * 0.5, z: md * 0.5 };

  function makeBig(sizeKey, pos) {
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

    // Composite shapes for medium/large — reuse the same logic as small composites
    // but positioned at the big building location
    const groupId = -1; // placeholder, will be set below
    const segW = rng.float(fp.min / 2, fp.max / 2);
    const segD = rng.float(fp.min / 2, fp.max / 2);
    const results = [];
    const actualGroupId = results; // use results array ref as temp, set groupId after

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
      // Fallback — shouldn't happen
      return [{ x, z, w, d, maxTier, size: sizeKey, height: 'tall', blockIndex: 0, shape: 'full' }];
    }

    // Mark all parts with a shared texture group (placeholder, resolved below)
    const groupMarker = Symbol('group');
    for (const r of results) r._groupMarker = groupMarker;
    return results;
  }

  // Collect all big buildings (makeBig returns arrays now)
  let bigResults = [];
  switch (layout) {
    case 0: bigResults = makeBig('large', C); break;
    case 1: bigResults = [...makeBig('large', TL), ...makeBig('large', BR)]; break;
    case 2: bigResults = [...makeBig('medium', TL), ...makeBig('medium', BR), ...makeBig('medium', TR)]; break;
    case 3: bigResults = [...makeBig('medium', TL), ...makeBig('medium', BL), ...makeBig('medium', TR)]; break;
    case 4: {
      const TL1 = { x: mw * 0.15, z: md * 0.15 };
      const TL2 = { x: mw * 0.35, z: md * 0.35 };
      bigResults = [...makeBig('medium', TL1), ...makeBig('medium', TL2), ...makeBig('medium', BR), ...makeBig('medium', TR)];
      break;
    }
  }

  // Resolve texture groups — buildings sharing a _groupMarker get the same textureGroup index
  // based on their final position in the array
  const groups = new Map();
  for (let i = 0; i < bigResults.length; i++) {
    const b = bigResults[i];
    if (b._groupMarker) {
      if (!groups.has(b._groupMarker)) groups.set(b._groupMarker, i);
      b.textureGroup = groups.get(b._groupMarker);
      delete b._groupMarker;
    }
  }

  return bigResults;
}
