export function findInteriorLadderTierRange(q, nq, tier, bq, maxTier) {
  let baseTier = -1;
  for (let t = tier - 1; t >= 1; t--) {
    const pAtT = bq.tiers[t];
    if (pAtT && pAtT.has(q) && pAtT.has(nq)) {
      baseTier = t;
      break;
    }
  }
  if (baseTier < 0) baseTier = 0;

  let topTier = tier;
  for (let t = tier + 1; t <= maxTier; t++) {
    const pAtT = bq.tiers[t];
    if (pAtT && pAtT.has(q) && !pAtT.has(nq)) {
      topTier = t;
    } else {
      break;
    }
  }

  return { baseTier, topTier };
}
