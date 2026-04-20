const WINDOW_WIDTHS = [1, 2, 4];

function resolvePlan(faceLength, startWidth) {
  const candidates = WINDOW_WIDTHS.slice(0, WINDOW_WIDTHS.indexOf(startWidth) + 1).reverse();
  for (const ww of candidates) {
    for (const count of [4, 3, 2]) {
      const spacing = (faceLength - count * ww) / (count + 1);
      if (spacing >= 1) return { windowWidth: ww, count, spacing };
    }
  }
  return null;
}

// Build window plans for all buildings. Returns one plan entry per building:
// { ns: { windowWidth, count, spacing } | null, ew: ... } | null (small buildings)
export function buildWindowPlans(buildings, rng) {
  return buildings.map(b => {
    if (b.size === 'small') return null;
    const windowWidth = rng.pick(WINDOW_WIDTHS);
    const nsLength = Math.round(b.w);
    const ewLength = Math.round(b.d);
    const ns = resolvePlan(nsLength, windowWidth);
    const ew = nsLength === ewLength ? ns : resolvePlan(ewLength, windowWidth);
    return { ns, ew };
  });
}

// Apply a window plan to a subdivided wall grid.
// Window positions are computed relative to the building face origin so they
// stay consistent across segments and tiers.
export function applyWindowPlan(grid, wall, plan, building) {
  if (!plan) return;
  const { windowWidth, count, spacing } = plan;
  const isNS = wall.direction === 'N' || wall.direction === 'S';
  const segOffset = Math.round(isNS ? (wall.x - building.x) : (wall.z - building.z));

  for (let i = 0; i < count; i++) {
    const winStart = Math.round(spacing + i * (windowWidth + spacing)) - segOffset;
    for (let col = winStart; col < winStart + windowWidth; col++) {
      if (col < 0 || col >= grid.cols) continue;
      for (const cell of grid.cells) {
        if (cell.col === col && cell.row >= 1) cell.alive = false;
      }
    }
  }
}
