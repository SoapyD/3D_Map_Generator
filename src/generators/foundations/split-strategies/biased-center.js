// Prefers splitting along the longer axis (same as balanced) but pulls the
// split position toward the midpoint of each region, producing more uniform
// block sizes and a denser, more regular city feel.
export const biasedCenter = {
  chooseAxis(region, canSplitX, canSplitZ, rng) {
    if (canSplitX && canSplitZ)
      return region.w >= region.d ? rng.chance(0.7) : rng.chance(0.3);
    return canSplitX;
  },
  chooseSplitPos(min, max, rng, bbd) {
    const mid = (min + max) / 2;
    const raw = rng.float(min, max);
    // 70% pull toward the midpoint keeps some variation while strongly
    // preferring near-equal splits
    return raw * 0.3 + mid * 0.7;
  },
};
