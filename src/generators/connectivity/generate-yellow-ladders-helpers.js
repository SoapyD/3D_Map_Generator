import { CONNECTIVITY } from '../../config.js';
import { findHighestWalledTier } from './find-highest-walled-tier.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

export function buildYellowLadderAtEndpoint(w, endpoint, data, config) {
  const { tierHeight, slabThickness } = config;
  const tier = Math.round(w.y / tierHeight);
  const wallTierY = tier * tierHeight + slabThickness;
  const margin = 0.3;

  let testX, testZ, testW, testD;
  if (w.axis === 'x') {
    testX = endpoint === 'start' ? w.x - margin : w.x + w.w - margin;
    testZ = w.z; testW = margin * 2; testD = w.d;
  } else {
    testX = w.x; testZ = endpoint === 'start' ? w.z - margin : w.z + w.d - margin;
    testW = w.w; testD = margin * 2;
  }

  let touchesWall = false;
  for (const wall of data.walls) {
    if (Math.abs(wall.baseY - wallTierY) > 0.5) continue;
    const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
    const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
    if (testX < wallX1 + margin && testX + testW > wall.x - margin &&
        testZ < wallZ1 + margin && testZ + testD > wall.z - margin) {
      touchesWall = true; break;
    }
  }
  if (!touchesWall) return null;

  const wallOffset = 0.3;
  let ladderX, ladderZ, ladderW, ladderD;
  if (w.axis === 'x') {
    ladderX = endpoint === 'start' ? w.x - LADDER_DEPTH + wallOffset : w.x + w.w - wallOffset;
    ladderZ = w.z + w.d / 2 - LADDER_WIDTH / 2;
    ladderW = LADDER_DEPTH; ladderD = LADDER_WIDTH;
  } else {
    ladderX = w.x + w.w / 2 - LADDER_WIDTH / 2;
    ladderZ = endpoint === 'start' ? w.z - LADDER_DEPTH + wallOffset : w.z + w.d - wallOffset;
    ladderW = LADDER_WIDTH; ladderD = LADDER_DEPTH;
  }

  const topTier = findHighestWalledTier(ladderX, ladderZ, ladderW, ladderD, tier, data, config);

  let ladderTopTier = topTier + 1;
  while (ladderTopTier > tier) {
    const fd = data.floors.find((f) => f.tier === ladderTopTier);
    if (fd && fd.sections.some((s) =>
      ladderX < s.x + s.w + 0.5 && ladderX + ladderW > s.x - 0.5 &&
      ladderZ < s.z + s.d + 0.5 && ladderZ + ladderD > s.z - 0.5
    )) break;
    ladderTopTier--;
  }

  const ladderY0 = w.y;
  const ladderY1 = ladderTopTier * tierHeight;
  if (ladderY1 <= ladderY0) return null;

  return {
    type: 'ladder', parentWalkway: w,
    x: ladderX, z: ladderZ, w: ladderW, d: ladderD,
    y0: ladderY0, y1: ladderY1,
  };
}
