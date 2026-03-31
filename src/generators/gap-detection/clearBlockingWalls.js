// At a forced connection endpoint, find blocking walls and clear them if >50% coverage
// Returns false if the endpoint has no accessible floor (no connection possible)
export function clearBlockingWalls(candidate, endpointX, endpointZ, facingDir, state) {
  const { walls, config } = state;
  // facingDir: 'east'|'west'|'north'|'south' — the building face the walkway arrives at
  const wt = config.wallThickness;
  const tierY = candidate.y;
  const tierH = config.tierHeight;

  // Determine the cross-axis span of the walkway at this endpoint
  let crossMin, crossMax;
  if (candidate.axis === 'x') {
    crossMin = candidate.z;
    crossMax = candidate.z + candidate.d;
  } else {
    crossMin = candidate.x;
    crossMax = candidate.x + candidate.w;
  }
  const walkwaySpan = crossMax - crossMin;

  // Find wall segments at this face that overlap the walkway's cross-axis span
  const blocking = [];
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    // Wall must be at the right tier (baseY within this tier's range)
    if (w.baseY < tierY - tierH + 0.1 || w.baseY > tierY + 0.1) continue;

    if (facingDir === 'east' || facingDir === 'west') {
      // East/west faces: wall runs along Z axis
      if (w.axis !== 'z') continue;
      // Wall X must be flush with the endpoint
      if (Math.abs(w.x - endpointX) > wt + 0.5 && Math.abs(w.x + wt - endpointX) > 0.5) continue;
      // Check Z overlap with walkway span
      const overlapMin = Math.max(w.z, crossMin);
      const overlapMax = Math.min(w.z + w.length, crossMax);
      if (overlapMax > overlapMin) {
        blocking.push({ index: i, overlap: overlapMax - overlapMin });
      }
    } else {
      // North/south faces: wall runs along X axis
      if (w.axis !== 'x') continue;
      // Wall Z must be flush with the endpoint
      if (Math.abs(w.z - endpointZ) > wt + 0.5 && Math.abs(w.z + wt - endpointZ) > 0.5) continue;
      // Check X overlap with walkway span
      const overlapMin = Math.max(w.x, crossMin);
      const overlapMax = Math.min(w.x + w.length, crossMax);
      if (overlapMax > overlapMin) {
        blocking.push({ index: i, overlap: overlapMax - overlapMin });
      }
    }
  }

  if (blocking.length === 0) return true; // no walls blocking, all good

  const totalBlocked = blocking.reduce((sum, b) => sum + b.overlap, 0);
  const coverage = totalBlocked / walkwaySpan;

  if (coverage > 0.5) {
    // Wall blocks >50% — delete the blocking wall segments to make room
    const toRemove = blocking.map(b => b.index).sort((a, b) => b - a); // reverse order for safe splice
    for (const idx of toRemove) {
      walls.splice(idx, 1);
    }
  }
  // coverage <= 50%: leave walls as-is, models can get through
  return true;
}
