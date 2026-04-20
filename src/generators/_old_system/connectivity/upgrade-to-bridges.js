import { CONNECTIVITY } from '../../config.js';
import { alignBranchBridges } from './align-branch-bridges.js';

export function upgradeToBridges(finalWalkways, tierHeight, rng) {
  const bridges = [];
  const remainingWalkways = [];
  const bridgeVariants = CONNECTIVITY.bridgeVariants;

  const upgradeMap = new Map();
  for (const w of finalWalkways) {
    if (w.branch) continue;
    const walkwayTier = Math.round(w.y / tierHeight);
    if (walkwayTier >= 2 && rng.chance(CONNECTIVITY.bridgeChance)) {
      const entries = Object.entries(bridgeVariants);
      const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
      const roll = rng.random() * totalWeight;
      let cum = 0, variant = entries[0][0];
      for (const [name, v] of entries) {
        cum += v.weight;
        if (roll < cum) { variant = name; break; }
      }
      upgradeMap.set(w, variant);
    }
  }

  let nextTexId = 0;
  const texIdMap = new Map();
  for (const w of finalWalkways) {
    if (w.branch) continue;
    texIdMap.set(w, nextTexId++);
  }
  for (const w of finalWalkways) {
    if (!w.branch || !w.parentRef) continue;
    const parentId = texIdMap.get(w.parentRef);
    texIdMap.set(w, parentId !== undefined ? parentId : nextTexId++);
  }

  for (const w of finalWalkways) {
    let variant = w.branch && w.parentRef
      ? upgradeMap.get(w.parentRef) || null
      : upgradeMap.get(w) || null;

    const textureId = texIdMap.get(w);
    if (variant) {
      const bw = CONNECTIVITY.bridgeWidth;
      let bridge;
      if (w.axis === 'x') {
        const centreZ = w.z + w.d / 2;
        bridge = { ...w, type: 'bridge', z: centreZ - bw / 2, d: bw, variant, textureId };
      } else {
        const centreX = w.x + w.w / 2;
        bridge = { ...w, type: 'bridge', x: centreX - bw / 2, w: bw, variant, textureId };
      }
      bridges.push(bridge);
    } else {
      w.textureId = textureId;
      remainingWalkways.push(w);
    }
  }

  alignBranchBridges(bridges);

  return { bridges, remainingWalkways };
}
