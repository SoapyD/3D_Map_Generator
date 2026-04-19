import { CONNECTIVITY } from '../../config.js';

export function buildWalkwayRect(edge, srcRect, tgtRect, y, WALKWAY_WIDTH) {
  const tgtCx = tgtRect.x + tgtRect.w / 2;
  const tgtCz = tgtRect.z + tgtRect.d / 2;
  if (edge.side === 'east' && tgtCx < srcRect.x + srcRect.w) return null;
  if (edge.side === 'west' && tgtCx > srcRect.x) return null;
  if (edge.side === 'south' && tgtCz < srcRect.z + srcRect.d) return null;
  if (edge.side === 'north' && tgtCz > srcRect.z) return null;

  if (edge.side === 'east' || edge.side === 'west') {
    const gs = edge.side === 'east' ? srcRect.x + srcRect.w : tgtRect.x + tgtRect.w;
    const ge = edge.side === 'east' ? tgtRect.x : srcRect.x;
    if (ge <= gs) return null;
    const len = ge - gs;
    if (len < CONNECTIVITY.minWalkwayLength || len > CONNECTIVITY.maxWalkwayLength) return null;
    const clampedZ = Math.max(tgtRect.z + WALKWAY_WIDTH / 2, Math.min(edge.z, tgtRect.z + tgtRect.d - WALKWAY_WIDTH / 2));
    return { type: 'walkway', x: gs, z: clampedZ - WALKWAY_WIDTH / 2, w: len, d: WALKWAY_WIDTH, y, axis: 'x' };
  } else {
    const gs = edge.side === 'south' ? srcRect.z + srcRect.d : tgtRect.z + tgtRect.d;
    const ge = edge.side === 'south' ? tgtRect.z : srcRect.z;
    if (ge <= gs) return null;
    const len = ge - gs;
    if (len < CONNECTIVITY.minWalkwayLength || len > CONNECTIVITY.maxWalkwayLength) return null;
    const clampedX = Math.max(tgtRect.x + WALKWAY_WIDTH / 2, Math.min(edge.x, tgtRect.x + tgtRect.w - WALKWAY_WIDTH / 2));
    return { type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: gs, w: WALKWAY_WIDTH, d: len, y, axis: 'z' };
  }
}
