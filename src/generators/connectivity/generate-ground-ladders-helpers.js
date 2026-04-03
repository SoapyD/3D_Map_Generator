export function buildGroundLadderForEdge(lx, lz, lw, ld, data, config) {
  const { tierHeight, slabThickness } = config;
  const margin = 0.3;

  const groundWallY = slabThickness;
  let hasGroundWall = false;
  for (const wall of data.walls) {
    if (Math.abs(wall.baseY - groundWallY) > 0.5) continue;
    const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
    const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
    if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
        lz < wallZ1 + margin && lz + ld > wall.z - margin) {
      hasGroundWall = true; break;
    }
  }
  if (!hasGroundWall) return null;

  let topTier = 0;
  for (let t = 1; t <= config.tiers; t++) {
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

  let ladderTopTier = topTier + 1;
  while (ladderTopTier > 0) {
    const fd = data.floors.find(f => f.tier === ladderTopTier);
    if (fd && fd.sections.some(s =>
      lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
      lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
    )) break;
    ladderTopTier--;
  }

  const ladderY0 = 0;
  const ladderY1 = ladderTopTier * tierHeight;
  if (ladderY1 <= ladderY0) return null;

  return { type: 'ground_ladder', x: lx, z: lz, w: lw, d: ld, y0: ladderY0, y1: ladderY1 };
}
