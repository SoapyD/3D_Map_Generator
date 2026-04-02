import { WALL } from '../config.js';

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
