import { WALL } from '../../config.js';
import { mergeSegments } from './merge-segments.js';

const WALL_QUAD_SIZE = WALL.quadSize;
const UPPER_REMOVAL_RATIO = WALL.upperRemovalRatio;
const LOWER_REMOVAL_RATIO = WALL.lowerRemovalRatio;

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
