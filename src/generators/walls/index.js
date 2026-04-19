import { extractWallSegments } from './extract-wall-segments.js';

export function generateWalls(data, config, rng, matrix) {
  const walls = extractWallSegments(data, config, matrix);
  return { ...data, walls };
}
