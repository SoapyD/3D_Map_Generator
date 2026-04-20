export function findHighestWalledTier(lx, lz, lw, ld, startTier, data, config) {
  const { tierHeight, slabThickness } = config;
  const margin = 0.3;
  let topTier = startTier;
  for (let t = startTier + 1; t <= config.tiers; t++) {
    const checkY = t * tierHeight + slabThickness;
    let hasWall = false;
    for (const wall of data.walls) {
      if (Math.abs(wall.baseY - checkY) > 0.5) continue;
      const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
      const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
      if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
          lz < wallZ1 + margin && lz + ld > wall.z - margin) {
        hasWall = true; break;
      }
    }
    if (hasWall) topTier = t;
    else break;
  }
  return topTier;
}
