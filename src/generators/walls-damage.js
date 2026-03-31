/**
 * Wall damage, merging, building, and interior variant utilities.
 *
 * Extracted from walls.js — contains:
 *   applyWallDamage, mergeSegments, buildWall, pickInteriorVariant
 */

import { WALL } from '../config.js';

const WALL_QUAD_SIZE = WALL.quadSize;
const UPPER_REMOVAL_RATIO = WALL.upperRemovalRatio;
const LOWER_REMOVAL_RATIO = WALL.lowerRemovalRatio;

export function pickInteriorVariant(rng) {
  const variants = WALL.interiorWallVariants;
  if (!variants) return 'centreNS';
  const entries = Object.entries(variants);
  const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
  const roll = rng.random() * totalWeight;
  let cumulative = 0;
  for (const [name, v] of entries) {
    cumulative += v.weight;
    if (roll < cumulative) return name;
  }
  return entries[0][0];
}

/**
 * Divide wall into upper/lower quadrant grid and remove some.
 * Upper row: up to 50% removed. Lower row: up to 30% removed.
 * Removals spread from first removal adjacently.
 */
export function applyWallDamage(wallDef, rng) {
  const { x, z, length, height, baseY, thickness, axis } = wallDef;
  const cols = Math.max(1, Math.round(length / WALL_QUAD_SIZE));
  const rows = 2;
  const quadW = length / cols;
  const quadH = height / rows;

  const grid = Array.from({ length: cols }, () => [true, true]);

  // Upper row removal
  const maxUpperRemove = Math.floor(cols * UPPER_REMOVAL_RATIO);
  const upperToRemove = maxUpperRemove > 0 ? rng.int(0, maxUpperRemove) : 0;
  const removed = [];

  for (let r = 0; r < upperToRemove; r++) {
    if (r === 0) {
      const col = rng.int(0, cols - 1);
      grid[col][1] = false;
      removed.push({ col, row: 1 });
    } else {
      const candidates = [];
      for (const prev of removed) {
        if (prev.row !== 1) continue;
        if (prev.col > 0 && grid[prev.col - 1][1]) candidates.push(prev.col - 1);
        if (prev.col < cols - 1 && grid[prev.col + 1][1]) candidates.push(prev.col + 1);
      }
      if (candidates.length === 0) break;
      const col = rng.pick(candidates);
      grid[col][1] = false;
      removed.push({ col, row: 1 });
    }
  }

  // Lower row removal
  const maxLowerRemove = Math.floor(cols * LOWER_REMOVAL_RATIO);
  const lowerToRemove = maxLowerRemove > 0 ? rng.int(0, maxLowerRemove) : 0;

  for (let r = 0; r < lowerToRemove; r++) {
    const candidates = [];
    for (const prev of removed) {
      if (prev.row === 1 && grid[prev.col][0]) candidates.push(prev.col);
      if (prev.row === 0) {
        if (prev.col > 0 && grid[prev.col - 1][0]) candidates.push(prev.col - 1);
        if (prev.col < cols - 1 && grid[prev.col + 1][0]) candidates.push(prev.col + 1);
      }
    }
    if (candidates.length === 0) break;
    const col = rng.pick(candidates);
    grid[col][0] = false;
    removed.push({ col, row: 0 });
  }

  // Convert to segments
  const segments = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (!grid[col][row]) continue;
      const segBaseY = baseY + row * quadH;
      const offset = col * quadW;
      segments.push({
        x: axis === 'x' ? x + offset : x,
        z: axis === 'z' ? z + offset : z,
        length: quadW,
        height: quadH,
        baseY: segBaseY,
        thickness,
        axis,
      });
    }
  }

  return mergeSegments(segments);
}

/**
 * Merge adjacent segments with same height and baseY.
 */
export function mergeSegments(segments) {
  if (segments.length <= 1) return segments;
  const byRow = new Map();
  for (const s of segments) {
    const key = s.baseY.toFixed(2);
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(s);
  }
  const merged = [];
  for (const [, rowSegs] of byRow) {
    rowSegs.sort((a, b) => (a.axis === 'x' ? a.x - b.x : a.z - b.z));
    let current = { ...rowSegs[0] };
    for (let i = 1; i < rowSegs.length; i++) {
      const next = rowSegs[i];
      const currEnd = current.axis === 'x' ? current.x + current.length : current.z + current.length;
      const nextStart = next.axis === 'x' ? next.x : next.z;
      if (Math.abs(currEnd - nextStart) < 0.01 && Math.abs(current.height - next.height) < 0.01) {
        current.length += next.length;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }
  return merged;
}

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
