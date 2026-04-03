import { DELETIONS } from '../../config.js';

export function validateWalkway(walkway, tier, data, config, existingWalkways) {
  const { tierHeight, slabThickness } = config;
  const floorData = data.floors.find(f => f.tier === tier);
  const wallTierY = tier * tierHeight + slabThickness;
  const margin = 0.3;

  let hitsWall = false;
  for (const wall of data.walls) {
    if (Math.abs(wall.baseY - wallTierY) > 0.5) continue;
    const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
    const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
    if (walkway.x < wallX1 + margin && walkway.x + walkway.w > wall.x - margin &&
        walkway.z < wallZ1 + margin && walkway.z + walkway.d > wall.z - margin) {
      hitsWall = true; break;
    }
  }
  let blocked = false;
  if (DELETIONS.walkwayWallCollision && hitsWall) blocked = true;

  if (floorData) {
    let startTouches = false, endTouches = false;
    for (const s of floorData.sections) {
      if (walkway.axis === 'x') {
        if (Math.abs(s.x + s.w - walkway.x) < 0.5 && walkway.z + walkway.d > s.z && walkway.z < s.z + s.d) startTouches = true;
        if (Math.abs(s.x - (walkway.x + walkway.w)) < 0.5 && walkway.z + walkway.d > s.z && walkway.z < s.z + s.d) endTouches = true;
      } else {
        if (Math.abs(s.z + s.d - walkway.z) < 0.5 && walkway.x + walkway.w > s.x && walkway.x < s.x + s.w) startTouches = true;
        if (Math.abs(s.z - (walkway.z + walkway.d)) < 0.5 && walkway.x + walkway.w > s.x && walkway.x < s.x + s.w) endTouches = true;
      }
    }
    if (DELETIONS.walkwayBothEndsCheck && (!startTouches || !endTouches)) return { valid: false };

    let startOverlap = 0, endOverlap = 0;
    const wSpan = walkway.axis === 'x' ? walkway.d : walkway.w;
    for (const s of floorData.sections) {
      if (walkway.axis === 'x') {
        if (Math.abs(s.x + s.w - walkway.x) < 0.5) {
          const ov = Math.min(walkway.z + walkway.d, s.z + s.d) - Math.max(walkway.z, s.z);
          if (ov > startOverlap) startOverlap = ov;
        }
        if (Math.abs(s.x - (walkway.x + walkway.w)) < 0.5) {
          const ov = Math.min(walkway.z + walkway.d, s.z + s.d) - Math.max(walkway.z, s.z);
          if (ov > endOverlap) endOverlap = ov;
        }
      } else {
        if (Math.abs(s.z + s.d - walkway.z) < 0.5) {
          const ov = Math.min(walkway.x + walkway.w, s.x + s.w) - Math.max(walkway.x, s.x);
          if (ov > startOverlap) startOverlap = ov;
        }
        if (Math.abs(s.z - (walkway.z + walkway.d)) < 0.5) {
          const ov = Math.min(walkway.x + walkway.w, s.x + s.w) - Math.max(walkway.x, s.x);
          if (ov > endOverlap) endOverlap = ov;
        }
      }
    }
    if (startOverlap / wSpan < 0.5 || endOverlap / wSpan < 0.5) return { valid: false };
  }

  for (const existing of existingWalkways) {
    if (existing.axis !== walkway.axis) continue;
    if (Math.abs(existing.y - walkway.y) < 0.5) continue;
    if (walkway.x < existing.x + existing.w && walkway.x + walkway.w > existing.x &&
        walkway.z < existing.z + existing.d && walkway.z + walkway.d > existing.z) {
      return { valid: false };
    }
  }

  return { valid: true, blocked };
}
