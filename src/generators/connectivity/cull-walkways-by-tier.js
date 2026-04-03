import { CONNECTIVITY, DELETIONS } from '../../config.js';

export function cullWalkwaysByTier(filteredWalkways, rng, tierHeight) {
  if (!DELETIONS.walkwayKeepRatioCull) return filteredWalkways;
  const byTier = new Map();
  for (const w of filteredWalkways) {
    const t = Math.round(w.y / tierHeight);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(w);
  }
  const culled = [];
  for (const [, tierWalkways] of byTier) {
    rng.shuffle(tierWalkways);
    const keep = Math.max(1, Math.ceil(tierWalkways.length * CONNECTIVITY.walkwayKeepRatio));
    culled.push(...tierWalkways.slice(0, keep));
  }
  return culled;
}
