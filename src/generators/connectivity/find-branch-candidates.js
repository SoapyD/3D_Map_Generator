import { CONNECTIVITY } from '../../config.js';
import { findBuildingIndex } from './find-building-index.js';
import { collectTierSectionsAndConnected } from './collect-tier-sections.js';

export function findBranchCandidates(forcedWalkways, data, config) {
  const { tierHeight } = config;
  const buildings = data.buildings;
  const minLen = CONNECTIVITY.branchMinLength || 3;
  const maxLen = CONNECTIVITY.branchMaxLength || 14;
  const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

  const candidates = [];

  for (const fw of forcedWalkways) {
    const result = collectTierSectionsAndConnected(data, fw, tierHeight);
    if (!result) continue;
    const { allSections, connectedBIs } = result;

    const branchAxis = fw.axis === 'x' ? 'z' : 'x';

    for (const s of allSections) {
      const bi = findBuildingIndex(s, buildings);
      if (bi < 0 || connectedBIs.has(bi)) continue;

      if (branchAxis === 'z') {
        const overlapMin = Math.max(s.x, fw.x);
        const overlapMax = Math.min(s.x + s.w, fw.x + fw.w);
        if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;

        const fwEdgeN = fw.z;
        const fwEdgeS = fw.z + fw.d;
        for (const dir of [-1, 1]) {
          const dist = dir > 0 ? s.z - fwEdgeS : fwEdgeN - (s.z + s.d);
          if (dist < minLen || dist > maxLen) continue;

          const anchorX = (overlapMin + overlapMax) / 2;
          const clampedX = Math.max(s.x + WALKWAY_WIDTH / 2, Math.min(anchorX, s.x + s.w - WALKWAY_WIDTH / 2));

          let startZ, endZ;
          if (dir > 0) { startZ = fwEdgeS; endZ = s.z; }
          else { startZ = s.z + s.d; endZ = fwEdgeN; }
          if (endZ <= startZ) continue;

          candidates.push({ branch: {
            type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: startZ,
            w: WALKWAY_WIDTH, d: endZ - startZ, y: fw.y, axis: 'z', forced: true, branch: true, parentRef: fw,
          }, length: dist, parent: fw });
        }
      } else {
        const overlapMin = Math.max(s.z, fw.z);
        const overlapMax = Math.min(s.z + s.d, fw.z + fw.d);
        if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;

        const fwEdgeW = fw.x;
        const fwEdgeE = fw.x + fw.w;
        for (const dir of [-1, 1]) {
          const dist = dir > 0 ? s.x - fwEdgeE : fwEdgeW - (s.x + s.w);
          if (dist < minLen || dist > maxLen) continue;

          const anchorZ = (overlapMin + overlapMax) / 2;
          const clampedZ = Math.max(s.z + WALKWAY_WIDTH / 2, Math.min(anchorZ, s.z + s.d - WALKWAY_WIDTH / 2));

          let startX, endX;
          if (dir > 0) { startX = fwEdgeE; endX = s.x; }
          else { startX = s.x + s.w; endX = fwEdgeW; }
          if (endX <= startX) continue;

          candidates.push({ branch: {
            type: 'walkway', x: startX, z: clampedZ - WALKWAY_WIDTH / 2,
            w: endX - startX, d: WALKWAY_WIDTH, y: fw.y, axis: 'x', forced: true, branch: true, parentRef: fw,
          }, length: dist, parent: fw });
        }
      }
    }
  }

  return candidates;
}
