import { BUILDING } from '../../config.js';

/**
 * Pick a building shape using weighted random selection for a given size category.
 */
export function pickShape(rng, sizeCategory = 'small') {
  const shapeMap = {
    small: BUILDING.smallShapes,
    medium: BUILDING.mediumShapes,
    large: BUILDING.largeShapes,
  };
  const shapes = shapeMap[sizeCategory] || BUILDING.smallShapes;
  if (!shapes) return 'full';

  const entries = Object.entries(shapes);
  const totalWeight = entries.reduce((sum, [, s]) => sum + s.weight, 0);
  const roll = rng.random() * totalWeight;
  let cumulative = 0;
  for (const [name, s] of entries) {
    cumulative += s.weight;
    if (roll < cumulative) return name;
  }
  return 'full';
}
