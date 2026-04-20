// Prefers splitting along the longer axis; position is uniformly random.
export const balanced = {
  chooseAxis(region, canSplitX, canSplitZ, rng) {
    if (canSplitX && canSplitZ)
      return region.w >= region.d ? rng.chance(0.7) : rng.chance(0.3);
    return canSplitX;
  },
  chooseSplitPos(min, max, rng, bbd) {
    return rng.float(min, max);
  },
};
