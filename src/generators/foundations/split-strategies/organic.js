// Ignores dimension bias — axis is chosen with a pure 50/50 coin flip.
// Produces irregular, uneven blocks with no dominant orientation.
export const organic = {
  chooseAxis(region, canSplitX, canSplitZ, rng) {
    if (canSplitX && canSplitZ) return rng.chance(0.5);
    return canSplitX;
  },
  chooseSplitPos(min, max, rng, bbd) {
    return rng.float(min, max);
  },
};
