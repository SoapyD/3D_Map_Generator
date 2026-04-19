/**
 * Stage 4: Wall Generation — Quadrant-Driven
 *
 * Placement:
 * - For each tier, find quadrants present on the floor ABOVE
 * - Generate up to 2 walls along the outer edges of those quadrants
 *
 * Wall damage (quadrant system):
 * - Each wall is divided into a grid of quadrants: columns × 2 rows (upper/lower)
 * - Column count = wall length / WALL_QUAD_SIZE (3")
 * - Up to 30% of quadrants can be removed
 * - First removal is random, subsequent removals must be adjacent to previous
 *
 * Quadrant outer edges:
 *   0: north, west
 *   1: north, east
 *   2: south, west
 *   3: south, east
 */

import { generateExteriorWalls } from './generate-exterior-walls.js';
import { generateInteriorWalls } from './generate-interior-walls.js';

export function generateWalls(data, config, rng) {
  const walls = generateExteriorWalls(data, config, rng);
  const interiorWalls = generateInteriorWalls(data, config, rng);
  walls.push(...interiorWalls);
  return { ...data, walls };
}
